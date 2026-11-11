DO $migration$
DECLARE
  duplicate_pair record;
BEGIN
  SELECT show_id, seat_id, count(*) AS booking_count
  INTO duplicate_pair
  FROM bookings
  WHERE status IN ('pending', 'confirmed')
  GROUP BY show_id, seat_id
  HAVING count(*) > 1
  ORDER BY show_id, seat_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'ACTIVE_BOOKING_DUPLICATES: show %s, seat %s has %s pending/confirmed bookings. Run: SELECT show_id, seat_id, array_agg(id) FROM bookings WHERE status IN (''pending'', ''confirmed'') GROUP BY show_id, seat_id HAVING count(*) > 1. Reconcile the records without deleting history, then rerun the migration.',
        duplicate_pair.show_id,
        duplicate_pair.seat_id,
        duplicate_pair.booking_count
      );
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_seat_per_show_idx
  ON bookings (show_id, seat_id)
  WHERE status IN ('pending', 'confirmed');
