import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const bookingId = "8a4c2cb6-362b-4d57-98ad-90889231bf23";
const showId = "b506b3a4-478b-4d0a-a9e6-ec32a1f744c9";
const seatId = "5c4fe560-11af-4a66-a998-c271a7780d96";

function createCancellationDatabase({
  bookingStatus = "pending",
  seatStatus = "held",
  bookingExists = true,
  failSeatRelease = false,
} = {}) {
  const state = {
    booking: bookingExists
      ? {
          id: bookingId,
          booking_reference: "TKT-TEST-REFERENCE",
          show_id: showId,
          seat_id: seatId,
          status: bookingStatus,
          updated_at: null,
        }
      : null,
    seat: {
      status: seatStatus,
      hold_expires_at: new Date(Date.now() + 60_000),
    },
    queries: [],
    rollbacks: 0,
  };
  let lockTail = Promise.resolve();

  const acquireSeatLock = async () => {
    const priorLock = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => {
      unlock = resolve;
    });
    await priorLock;
    return unlock;
  };

  const database = {
    async connect() {
      let releaseSeatLock;
      let modified = false;
      let bookingBackup;
      let seatBackup;
      return {
        async query(sql, values = []) {
          const normalized = sql.replace(/\s+/g, " ").trim();
          state.queries.push({ sql: normalized, values });

          if (normalized === "BEGIN") {
            bookingBackup = structuredClone(state.booking);
            seatBackup = structuredClone(state.seat);
            return { rows: [] };
          }
          if (normalized === "COMMIT") {
            releaseSeatLock?.();
            releaseSeatLock = undefined;
            return { rows: [] };
          }
          if (normalized === "ROLLBACK") {
            state.rollbacks += 1;
            if (modified) {
              state.booking = bookingBackup;
              state.seat = seatBackup;
            }
            releaseSeatLock?.();
            releaseSeatLock = undefined;
            return { rows: [] };
          }
          if (
            normalized.includes("FROM bookings") &&
            normalized.includes("WHERE id = $1") &&
            !normalized.includes("FOR UPDATE")
          ) {
            return {
              rows:
                state.booking && values[0] === state.booking.id
                  ? [
                      {
                        id: state.booking.id,
                        booking_reference: state.booking.booking_reference,
                        show_id: state.booking.show_id,
                        seat_id: state.booking.seat_id,
                      },
                    ]
                  : [],
            };
          }
          if (
            normalized.includes("FROM show_seats") &&
            normalized.includes("FOR UPDATE")
          ) {
            releaseSeatLock = await acquireSeatLock();
            return { rows: [{ status: state.seat.status }] };
          }
          if (
            normalized.includes("FROM bookings") &&
            normalized.includes("FOR UPDATE")
          ) {
            return {
              rows: state.booking ? [structuredClone(state.booking)] : [],
            };
          }
          if (normalized.startsWith("UPDATE bookings")) {
            modified = true;
            state.booking.status = "cancelled";
            state.booking.updated_at = new Date();
            return { rows: [structuredClone(state.booking)] };
          }
          if (normalized.startsWith("UPDATE show_seats")) {
            if (failSeatRelease) throw new Error("mock seat update failure");
            modified = true;
            state.seat.status = "available";
            state.seat.hold_expires_at = null;
            return { rows: [{ status: "available" }] };
          }
          throw new Error(`Unexpected mock SQL: ${normalized}`);
        },
        release() {
          releaseSeatLock?.();
          releaseSeatLock = undefined;
        },
      };
    },
  };

  return { database, state };
}

function cancelRequest(app, id = bookingId) {
  return request(app).delete(`/api/v1/reservations/${id}`);
}

test("DELETE reservation cancels the booking and releases its seat", async () => {
  const { database, state } = createCancellationDatabase();
  const app = createApp({ database });

  const response = await cancelRequest(app);

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "cancelled");
  assert.equal(response.body.booking.id, bookingId);
  assert.equal(response.body.booking.status, "cancelled");
  assert.deepEqual(response.body.seat, {
    showId,
    seatId,
    status: "available",
  });
  assert.equal(state.booking.status, "cancelled");
  assert.equal(state.seat.status, "available");

  const seatLockIndex = state.queries.findIndex(
    ({ sql }) => sql.includes("FROM show_seats") && sql.includes("FOR UPDATE"),
  );
  const bookingLockIndex = state.queries.findIndex(
    ({ sql }) => sql.includes("FROM bookings") && sql.includes("FOR UPDATE"),
  );
  assert.ok(seatLockIndex >= 0 && bookingLockIndex > seatLockIndex);
});

test("DELETE reservation rejects an invalid booking UUID", async () => {
  const { database, state } = createCancellationDatabase();
  const app = createApp({ database });

  const response = await cancelRequest(app, "not-a-uuid");

  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});

test("DELETE reservation returns 404 when the booking does not exist", async () => {
  const { database } = createCancellationDatabase({ bookingExists: false });
  const app = createApp({ database });

  const response = await cancelRequest(app);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Booking not found");
});

test("DELETE reservation returns 409 for an already cancelled booking", async () => {
  const { database, state } = createCancellationDatabase({
    bookingStatus: "cancelled",
  });
  const app = createApp({ database });

  const response = await cancelRequest(app);

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Booking has already been cancelled");
  assert.equal(state.seat.status, "held");
});

test("DELETE reservation releases both pending holds and confirmed seats", async () => {
  for (const [bookingStatus, seatStatus] of [
    ["pending", "held"],
    ["confirmed", "booked"],
  ]) {
    const { database, state } = createCancellationDatabase({
      bookingStatus,
      seatStatus,
    });
    const app = createApp({ database });

    const response = await cancelRequest(app);

    assert.equal(response.status, 200);
    assert.equal(state.booking.status, "cancelled");
    assert.equal(state.seat.status, "available");
    assert.equal(state.seat.hold_expires_at, null);
  }
});

test("concurrent mocked cancellations yield one success and one conflict", async () => {
  const { database, state } = createCancellationDatabase();
  const app = createApp({ database });

  const responses = await Promise.all([cancelRequest(app), cancelRequest(app)]);

  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(state.booking.status, "cancelled");
  assert.equal(state.seat.status, "available");
});

test("DELETE reservation rolls back booking status when seat release fails", async () => {
  const { database, state } = createCancellationDatabase({
    failSeatRelease: true,
  });
  const app = createApp({ database });

  const response = await cancelRequest(app);

  assert.equal(response.status, 500);
  assert.equal(response.body.message, "Unable to cancel booking");
  assert.equal(state.rollbacks, 1);
  assert.equal(state.booking.status, "pending");
  assert.equal(state.seat.status, "held");
});
