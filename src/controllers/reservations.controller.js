import { randomUUID } from "node:crypto";
import { logger } from "../config/logger.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIND_SHOW_FOR_RESERVATION = `
  SELECT id
  FROM shows
  WHERE id = $1
  FOR KEY SHARE
`;

const LOCK_SHOW_SEATS = `
  SELECT
    seat_id,
    status,
    (status = 'held' AND hold_expires_at <= clock_timestamp()) AS hold_expired
  FROM show_seats
  WHERE show_id = $1
    AND seat_id = ANY($2::uuid[])
  ORDER BY seat_id
  FOR UPDATE
`;

const CANCEL_EXPIRED_PENDING_BOOKINGS = `
  UPDATE bookings
  SET status = 'cancelled', updated_at = clock_timestamp()
  WHERE show_id = $1
    AND seat_id = ANY($2::uuid[])
    AND status = 'pending'
`;

const HOLD_SHOW_SEATS = `
  WITH expiry AS (
    SELECT clock_timestamp() + INTERVAL '15 minutes' AS expires_at
  )
  UPDATE show_seats AS show_seat
  SET status = 'held',
      hold_expires_at = expiry.expires_at,
      updated_at = clock_timestamp()
  FROM expiry
  WHERE show_seat.show_id = $1
    AND show_seat.seat_id = ANY($2::uuid[])
  RETURNING show_seat.hold_expires_at
`;

const CREATE_PENDING_BOOKING = `
  INSERT INTO bookings (
    booking_reference,
    show_id,
    seat_id,
    status,
    customer_name
  )
  VALUES ($1, $2, $3, 'pending', $4)
  RETURNING id, booking_reference, show_id, seat_id, status, customer_name, created_at
`;

const CONFLICTING_BOOKING_INDEXES = new Set([
  "bookings_one_active_seat_per_show_idx",
  "bookings_one_pending_seat_per_show_idx",
  "bookings_one_confirmed_seat_per_show_idx",
]);

function isReservationConflict(error) {
  return (
    error?.code === "23505" && CONFLICTING_BOOKING_INDEXES.has(error.constraint)
  );
}

export function createReservationHandler({ database }) {
  return async (req, res) => {
    const { showId } = req.params;
    const body = req.body;

    if (!UUID_PATTERN.test(showId)) {
      return res.status(400).json({
        status: "error",
        message: "showId must be a valid UUID",
      });
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Array.isArray(body.seatIds) ||
      body.seatIds.length === 0 ||
      body.seatIds.some(
        (seatId) => typeof seatId !== "string" || !UUID_PATTERN.test(seatId),
      ) ||
      typeof body.customerName !== "string" ||
      body.customerName.trim().length === 0 ||
      body.customerName.trim().length > 200
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "seatIds must be a non-empty UUID array and customerName must be 1 to 200 characters",
      });
    }

    const seatIds = body.seatIds.map((seatId) => seatId.toLowerCase());
    if (new Set(seatIds).size !== seatIds.length) {
      return res.status(400).json({
        status: "error",
        message: "seatIds must not contain duplicates",
      });
    }

    const customerName = body.customerName.trim();
    let client;
    let transactionStarted = false;

    try {
      client = await database.connect();
      await client.query("BEGIN");
      transactionStarted = true;

      const abort = async (status, payload) => {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(status).json(payload);
      };

      const showResult = await client.query(FIND_SHOW_FOR_RESERVATION, [
        showId,
      ]);
      if (showResult.rows.length === 0) {
        return await abort(404, {
          status: "error",
          message: "Show not found",
        });
      }

      const seatResult = await client.query(LOCK_SHOW_SEATS, [showId, seatIds]);
      if (seatResult.rows.length !== seatIds.length) {
        return await abort(404, {
          status: "error",
          message: "One or more seats were not found for this show",
        });
      }

      const unavailableSeat = seatResult.rows.find(
        ({ status, hold_expired }) =>
          status !== "available" && !(status === "held" && hold_expired),
      );
      if (unavailableSeat) {
        return await abort(409, {
          status: "error",
          message: "One or more seats are not available",
        });
      }

      const expiredSeatIds = seatResult.rows
        .filter(({ status, hold_expired }) => status === "held" && hold_expired)
        .map(({ seat_id }) => seat_id);
      if (expiredSeatIds.length > 0) {
        await client.query(CANCEL_EXPIRED_PENDING_BOOKINGS, [
          showId,
          expiredSeatIds,
        ]);
      }

      const holdResult = await client.query(HOLD_SHOW_SEATS, [showId, seatIds]);
      const expiresAt = holdResult.rows[0].hold_expires_at;
      const bookings = [];

      for (const seatId of seatIds) {
        const bookingResult = await client.query(CREATE_PENDING_BOOKING, [
          `TKT-${randomUUID().toUpperCase()}`,
          showId,
          seatId,
          customerName,
        ]);
        bookings.push(bookingResult.rows[0]);
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        reservation: {
          showId,
          customerName,
          expiresAt,
          bookings,
        },
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Keep the original failure private and return a generic error.
        }
      }

      if (isReservationConflict(error)) {
        return res.status(409).json({
          status: "error",
          message: "One or more seats are not available",
        });
      }

      logger.error({ showId }, "Failed to create cinema reservation");
      return res.status(500).json({
        status: "error",
        message: "Unable to create reservation",
      });
    } finally {
      client?.release();
    }
  };
}
