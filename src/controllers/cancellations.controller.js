import { logger } from "../config/logger.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIND_BOOKING = `
  SELECT id, booking_reference, show_id, seat_id
  FROM bookings
  WHERE id = $1
`;

const LOCK_SHOW_SEAT = `
  SELECT status
  FROM show_seats
  WHERE show_id = $1 AND seat_id = $2
  FOR UPDATE
`;

const LOCK_BOOKING = `
  SELECT id, booking_reference, show_id, seat_id, status
  FROM bookings
  WHERE id = $1
  FOR UPDATE
`;

const CANCEL_BOOKING = `
  UPDATE bookings
  SET status = 'cancelled', updated_at = clock_timestamp()
  WHERE id = $1
  RETURNING id, booking_reference, show_id, seat_id, status, updated_at
`;

const RELEASE_SHOW_SEAT = `
  UPDATE show_seats AS show_seat
  SET status = 'available',
      hold_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE show_seat.show_id = $1
    AND show_seat.seat_id = $2
    AND NOT EXISTS (
      SELECT 1
      FROM bookings AS active_booking
      WHERE active_booking.show_id = $1
        AND active_booking.seat_id = $2
        AND active_booking.id <> $3
        AND active_booking.status IN ('pending', 'confirmed')
    )
  RETURNING status
`;

export function createCancellationHandler({ database }) {
  return async (req, res) => {
    const { bookingId } = req.params;
    if (!UUID_PATTERN.test(bookingId)) {
      return res.status(400).json({
        status: "error",
        message: "bookingId must be a valid UUID",
      });
    }

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

      // Read the immutable seat identifiers first, then lock seat before booking.
      const initialBooking = await client.query(FIND_BOOKING, [bookingId]);
      if (initialBooking.rows.length === 0) {
        return await abort(404, {
          status: "error",
          message: "Booking not found",
        });
      }

      const { show_id: showId, seat_id: seatId } = initialBooking.rows[0];
      const seatLock = await client.query(LOCK_SHOW_SEAT, [showId, seatId]);
      if (seatLock.rows.length === 0) {
        logger.error({ bookingId }, "Booking has no associated show seat");
        return await abort(500, {
          status: "error",
          message: "Unable to cancel booking",
        });
      }

      const lockedBooking = await client.query(LOCK_BOOKING, [bookingId]);
      if (lockedBooking.rows.length === 0) {
        return await abort(404, {
          status: "error",
          message: "Booking not found",
        });
      }

      const booking = lockedBooking.rows[0];
      if (booking.status === "cancelled") {
        return await abort(409, {
          status: "error",
          message: "Booking has already been cancelled",
        });
      }
      if (!["pending", "confirmed"].includes(booking.status)) {
        return await abort(409, {
          status: "error",
          message: "Booking cannot be cancelled in its current state",
        });
      }

      const cancelledBooking = await client.query(CANCEL_BOOKING, [bookingId]);
      const releasedSeat = await client.query(RELEASE_SHOW_SEAT, [
        showId,
        seatId,
        bookingId,
      ]);

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "cancelled",
        booking: cancelledBooking.rows[0],
        seat: {
          showId,
          seatId,
          status: releasedSeat.rows[0]?.status ?? seatLock.rows[0].status,
        },
      });
    } catch {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Keep database details out of the response and logs.
        }
      }

      logger.error({ bookingId }, "Failed to cancel cinema booking");
      return res.status(500).json({
        status: "error",
        message: "Unable to cancel booking",
      });
    } finally {
      client?.release();
    }
  };
}
