ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_name text;

UPDATE bookings
SET customer_name = 'Unknown'
WHERE customer_name IS NULL;

ALTER TABLE bookings
  ALTER COLUMN customer_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_confirmed_seat_per_show_idx
  ON bookings (show_id, seat_id)
  WHERE status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_pending_seat_per_show_idx
  ON bookings (show_id, seat_id)
  WHERE status = 'pending';
