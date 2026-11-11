import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { database, pool } from "../src/config/database.js";

const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "true";

test(
  "PostgreSQL serializes concurrent cancellations and preserves booking history",
  { skip: !integrationEnabled },
  async () => {
    const showId = randomUUID();
    const seatId = randomUUID();
    const bookingId = randomUUID();
    const seatNumber = `CANCEL-IT-${randomUUID()}`;
    const setup = await pool.connect();
    let showInserted = false;

    try {
      await setup.query(
        `INSERT INTO shows (id, movie_title, screen_name, starts_at)
         VALUES ($1, 'Cancellation integration fixture', 'Cancellation Screen', now() + interval '1 day')`,
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
         VALUES ($1, $2, $3, $4, 'pending', 'Cancellation Integration')`,
        [bookingId, `TKT-${randomUUID()}`, showId, seatId],
      );

      const app = createApp({ database });
      const cancel = () =>
        request(app).delete(`/api/v1/reservations/${bookingId}`);
      const responses = await Promise.all([cancel(), cancel()]);
      assert.deepEqual(
        responses.map(({ status }) => status).sort(),
        [200, 409],
      );

      const result = await setup.query(
        `SELECT bookings.status AS booking_status, show_seats.status AS seat_status,
                show_seats.hold_expires_at
         FROM bookings
         JOIN show_seats ON show_seats.show_id = bookings.show_id
                       AND show_seats.seat_id = bookings.seat_id
         WHERE bookings.id = $1`,
        [bookingId],
      );
      assert.deepEqual(result.rows[0], {
        booking_status: "cancelled",
        seat_status: "available",
        hold_expires_at: null,
      });
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
