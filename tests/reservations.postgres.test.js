import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { database, pool } from "../src/config/database.js";

const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "true";

test(
  "PostgreSQL row locks serialize concurrent reservations and confirmed bookings stay unique",
  { skip: !integrationEnabled },
  async () => {
    const indexResult = await pool.query(
      `SELECT i.indisunique,
              pg_get_expr(i.indpred, i.indrelid) AS predicate
       FROM pg_index AS i
       WHERE i.indexrelid = to_regclass($1)`,
      ["bookings_one_active_seat_per_show_idx"],
    );
    assert.equal(indexResult.rows.length, 1);
    assert.equal(indexResult.rows[0].indisunique, true);
    assert.match(indexResult.rows[0].predicate, /pending/i);
    assert.match(indexResult.rows[0].predicate, /confirmed/i);

    const showId = randomUUID();
    const seatId = randomUUID();
    const seatNumber = `IT-${randomUUID()}`;
    const setup = await pool.connect();
    let showInserted = false;

    try {
      await setup.query(
        `INSERT INTO shows (id, movie_title, screen_name, starts_at)
         VALUES ($1, 'Concurrency integration fixture', 'Integration Screen', now() + interval '1 day')`,
        [showId],
      );
      showInserted = true;
      await setup.query("INSERT INTO seats (id, seat_number) VALUES ($1, $2)", [
        seatId,
        seatNumber,
      ]);
      await setup.query(
        "INSERT INTO show_seats (show_id, seat_id) VALUES ($1, $2)",
        [showId, seatId],
      );

      const app = createApp({ database });
      const sendReservation = () =>
        request(app)
          .post(`/api/v1/shows/${showId}/reservations`)
          .send({ seatIds: [seatId], customerName: "Concurrency Test" });

      const responses = await Promise.all([
        sendReservation(),
        sendReservation(),
      ]);
      assert.deepEqual(
        responses.map(({ status }) => status).sort(),
        [201, 409],
      );

      const result = await setup.query(
        "SELECT status FROM show_seats WHERE show_id = $1 AND seat_id = $2",
        [showId, seatId],
      );
      assert.equal(result.rows[0].status, "held");

      await assert.rejects(
        setup.query(
          `INSERT INTO bookings (booking_reference, show_id, seat_id, status, customer_name)
           VALUES ($1, $2, $3, 'confirmed', 'Cross Status Constraint Test')`,
          [`TKT-${randomUUID()}`, showId, seatId],
        ),
        (error) =>
          error.code === "23505" &&
          error.constraint === "bookings_one_active_seat_per_show_idx",
      );

      await setup.query(
        "UPDATE show_seats SET status = 'booked', hold_expires_at = NULL WHERE show_id = $1 AND seat_id = $2",
        [showId, seatId],
      );
      await setup.query(
        "UPDATE bookings SET status = 'confirmed' WHERE show_id = $1 AND seat_id = $2",
        [showId, seatId],
      );
      await assert.rejects(
        setup.query(
          `INSERT INTO bookings (booking_reference, show_id, seat_id, status, customer_name)
           VALUES ($1, $2, $3, 'confirmed', 'Constraint Test')`,
          [`TKT-${randomUUID()}`, showId, seatId],
        ),
        (error) =>
          error.code === "23505" &&
          [
            "bookings_one_active_seat_per_show_idx",
            "bookings_one_confirmed_seat_per_show_idx",
          ].includes(error.constraint),
      );
    } finally {
      if (showInserted) {
        try {
          await setup.query("DELETE FROM bookings WHERE show_id = $1", [
            showId,
          ]);
          await setup.query("DELETE FROM shows WHERE id = $1", [showId]);
          await setup.query("DELETE FROM seats WHERE id = $1", [seatId]);
        } finally {
          setup.release();
        }
      } else {
        setup.release();
      }
    }
  },
);

test(
  "PostgreSQL serializes concurrent reservation and cancellation for one seat",
  { skip: !integrationEnabled, timeout: 15_000 },
  async () => {
    const showId = randomUUID();
    const seatId = randomUUID();
    const bookingId = randomUUID();
    const seatNumber = `MIXED-IT-${randomUUID()}`;
    const bookingReference = `TKT-${randomUUID()}`;
    const setup = await pool.connect();
    let showInserted = false;

    try {
      await setup.query(
        `INSERT INTO shows (id, movie_title, screen_name, starts_at)
         VALUES ($1, 'Mixed operation integration fixture', 'Mixed Screen', now() + interval '1 day')`,
        [showId],
      );
      showInserted = true;
      await setup.query("INSERT INTO seats (id, seat_number) VALUES ($1, $2)", [
        seatId,
        seatNumber,
      ]);
      await setup.query(
        `INSERT INTO show_seats (show_id, seat_id, status, hold_expires_at)
         VALUES ($1, $2, 'held', clock_timestamp() + interval '15 minutes')`,
        [showId, seatId],
      );
      await setup.query(
        `INSERT INTO bookings (id, booking_reference, show_id, seat_id, status, customer_name)
         VALUES ($1, $2, $3, $4, 'pending', 'Mixed Operation Test')`,
        [bookingId, bookingReference, showId, seatId],
      );

      const app = createApp({ database });
      const cancellation = request(app).delete(
        `/api/v1/reservations/${bookingId}`,
      );
      const reservation = request(app)
        .post(`/api/v1/shows/${showId}/reservations`)
        .send({ seatIds: [seatId], customerName: "Mixed Operation Test" });
      const [cancelResponse, reservationResponse] = await Promise.all([
        cancellation,
        reservation,
      ]);

      assert.equal(cancelResponse.status, 200);
      assert.ok([201, 409].includes(reservationResponse.status));

      const finalState = await setup.query(
        `SELECT
           original.status AS original_booking_status,
           show_seats.status AS seat_status,
           show_seats.hold_expires_at,
           count(active.id)::int AS active_booking_count,
           array_remove(array_agg(active.status), NULL) AS active_booking_statuses
         FROM bookings AS original
         JOIN show_seats
           ON show_seats.show_id = original.show_id
          AND show_seats.seat_id = original.seat_id
         LEFT JOIN bookings AS active
           ON active.show_id = original.show_id
          AND active.seat_id = original.seat_id
          AND active.status IN ('pending', 'confirmed')
         WHERE original.id = $1
         GROUP BY original.status, show_seats.status, show_seats.hold_expires_at`,
        [bookingId],
      );

      assert.equal(finalState.rows.length, 1);
      const result = finalState.rows[0];
      assert.equal(result.original_booking_status, "cancelled");
      assert.ok(result.active_booking_count <= 1);

      if (result.active_booking_count === 0) {
        assert.equal(result.seat_status, "available");
        assert.equal(result.hold_expires_at, null);
      } else {
        assert.deepEqual(result.active_booking_statuses, ["pending"]);
        assert.equal(result.seat_status, "held");
        assert.ok(new Date(result.hold_expires_at) > new Date());
      }

      assert.equal(
        reservationResponse.status === 201,
        result.active_booking_count === 1,
      );
    } finally {
      if (showInserted) {
        try {
          await setup.query("DELETE FROM bookings WHERE show_id = $1", [
            showId,
          ]);
          await setup.query("DELETE FROM shows WHERE id = $1", [showId]);
          await setup.query("DELETE FROM seats WHERE id = $1", [seatId]);
        } finally {
          setup.release();
        }
      } else {
        setup.release();
      }
    }
  },
);
