import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const showId = "8a4c2cb6-362b-4d57-98ad-90889231bf23";
const seatId = "b506b3a4-478b-4d0a-a9e6-ec32a1f744c9";
const secondSeatId = "5c4fe560-11af-4a66-a998-c271a7780d96";

function createReservationDatabase({
  showExists = true,
  seats = [{ seat_id: seatId, status: "available", hold_expires_at: null }],
  failOnBookingInsert = false,
} = {}) {
  const state = {
    seats: structuredClone(seats),
    bookings: [],
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
      let transactionModified = false;
      let seatBackup;
      let bookingBackup;
      return {
        async query(sql, values = []) {
          const normalized = sql.replace(/\s+/g, " ").trim();
          state.queries.push({ sql: normalized, values });

          if (normalized === "BEGIN") {
            seatBackup = structuredClone(state.seats);
            bookingBackup = structuredClone(state.bookings);
            return { rows: [] };
          }
          if (normalized === "COMMIT") {
            releaseSeatLock?.();
            releaseSeatLock = undefined;
            return { rows: [] };
          }
          if (normalized === "ROLLBACK") {
            state.rollbacks += 1;
            if (transactionModified) {
              state.seats = seatBackup;
              state.bookings = bookingBackup;
            }
            releaseSeatLock?.();
            releaseSeatLock = undefined;
            return { rows: [] };
          }
          if (
            normalized.includes("FROM shows") &&
            normalized.includes("FOR KEY SHARE")
          ) {
            return { rows: showExists ? [{ id: values[0] }] : [] };
          }
          if (
            normalized.includes("FROM show_seats") &&
            normalized.includes("FOR UPDATE")
          ) {
            releaseSeatLock = await acquireSeatLock();
            const requestedIds = values[1];
            return {
              rows: state.seats
                .filter((seat) => requestedIds.includes(seat.seat_id))
                .map((seat) => ({
                  ...seat,
                  hold_expired:
                    seat.status === "held" &&
                    seat.hold_expires_at !== null &&
                    new Date(seat.hold_expires_at) <= new Date(),
                })),
            };
          }
          if (normalized.startsWith("UPDATE bookings")) {
            const expiredIds = values[1];
            for (const booking of state.bookings) {
              if (
                expiredIds.includes(booking.seat_id) &&
                booking.status === "pending"
              ) {
                booking.status = "cancelled";
                transactionModified = true;
              }
            }
            return { rows: [] };
          }
          if (normalized.startsWith("WITH expiry AS")) {
            transactionModified = true;
            const heldSeats = state.seats.filter((seat) =>
              values[1].includes(seat.seat_id),
            );
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            for (const seat of heldSeats) {
              seat.status = "held";
              seat.hold_expires_at = expiresAt;
            }
            return {
              rows: heldSeats.map((seat) => ({
                hold_expires_at: seat.hold_expires_at,
              })),
            };
          }
          if (normalized.startsWith("INSERT INTO bookings")) {
            if (failOnBookingInsert)
              throw new Error("mock booking insert failure");
            transactionModified = true;
            const booking = {
              id: `booking-${state.bookings.length + 1}`,
              booking_reference: values[0],
              show_id: values[1],
              seat_id: values[2],
              status: "pending",
              customer_name: values[3],
              created_at: new Date().toISOString(),
            };
            state.bookings.push(booking);
            return { rows: [booking] };
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

function reservationRequest(app, show = showId, requestedSeats = [seatId]) {
  return request(app)
    .post(`/api/v1/shows/${show}/reservations`)
    .send({ seatIds: requestedSeats, customerName: " Test User " });
}

test("POST reservation creates pending bookings and temporary seat holds", async () => {
  const { database, state } = createReservationDatabase({
    seats: [
      { seat_id: seatId, status: "available", hold_expires_at: null },
      { seat_id: secondSeatId, status: "available", hold_expires_at: null },
    ],
  });
  const app = createApp({ database });

  const response = await reservationRequest(app, showId, [
    seatId,
    secondSeatId,
  ]);

  assert.equal(response.status, 201);
  assert.equal(response.body.reservation.customerName, "Test User");
  assert.equal(
    new Date(response.body.reservation.expiresAt) > new Date(),
    true,
  );
  assert.equal(response.body.reservation.bookings.length, 2);
  for (const booking of response.body.reservation.bookings) {
    assert.match(booking.booking_reference, /^TKT-[0-9A-F-]{36}$/);
    assert.equal(booking.status, "pending");
  }
  assert.ok(state.seats.every((seat) => seat.status === "held"));
  assert.ok(
    state.queries.some(({ sql }) =>
      sql.includes("ORDER BY seat_id FOR UPDATE"),
    ),
  );
});

test("POST reservation rejects an invalid show UUID", async () => {
  const { database, state } = createReservationDatabase();
  const app = createApp({ database });

  const response = await reservationRequest(app, "not-a-uuid");

  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});

test("POST reservation returns 404 for a missing show", async () => {
  const { database } = createReservationDatabase({ showExists: false });
  const app = createApp({ database });

  const response = await reservationRequest(app);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Show not found");
});

test("POST reservation returns 404 when a seat does not belong to the show", async () => {
  const { database } = createReservationDatabase({ seats: [] });
  const app = createApp({ database });

  const response = await reservationRequest(app);

  assert.equal(response.status, 404);
  assert.match(response.body.message, /seats were not found/i);
});

test("POST reservation returns 409 when a seat is already held or booked", async () => {
  const { database, state } = createReservationDatabase({
    seats: [{ seat_id: seatId, status: "booked", hold_expires_at: null }],
  });
  const app = createApp({ database });

  const response = await reservationRequest(app);

  assert.equal(response.status, 409);
  assert.equal(state.rollbacks, 1);
  assert.equal(state.bookings.length, 0);
});

test("POST reservation rejects duplicate seat IDs", async () => {
  const { database, state } = createReservationDatabase();
  const app = createApp({ database });

  const response = await reservationRequest(app, showId, [
    seatId,
    seatId.toUpperCase(),
  ]);

  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});

test("concurrent mocked requests cannot both reserve the same seat", async () => {
  const { database, state } = createReservationDatabase();
  const app = createApp({ database });

  const responses = await Promise.all([
    reservationRequest(app),
    reservationRequest(app),
  ]);

  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(state.bookings.length, 1);
  assert.equal(state.seats[0].status, "held");
});

test("POST reservation rolls back seat holds if booking creation fails", async () => {
  const { database, state } = createReservationDatabase({
    failOnBookingInsert: true,
  });
  const app = createApp({ database });

  const response = await reservationRequest(app);

  assert.equal(response.status, 500);
  assert.equal(state.rollbacks, 1);
  assert.equal(state.seats[0].status, "available");
  assert.equal(state.bookings.length, 0);
});

test("POST reservation rejects invalid request body fields", async () => {
  const { database, state } = createReservationDatabase();
  const app = createApp({ database });

  const response = await request(app)
    .post(`/api/v1/shows/${showId}/reservations`)
    .send({ seatIds: [], customerName: " " });

  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});
