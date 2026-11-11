CREATE TABLE IF NOT EXISTS shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_title text NOT NULL,
  screen_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shows_seed_identity_unique UNIQUE (movie_title, screen_name, starts_at)
);

CREATE TABLE IF NOT EXISTS seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_number text NOT NULL UNIQUE,
  seat_type text NOT NULL DEFAULT 'standard'
    CHECK (seat_type IN ('standard', 'premium', 'accessible')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS show_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_id uuid NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'held', 'booked')),
  hold_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT show_seats_show_seat_unique UNIQUE (show_id, seat_id),
  CONSTRAINT show_seats_id_show_seat_unique UNIQUE (id, show_id, seat_id),
  CONSTRAINT show_seats_hold_expiry_check CHECK (status = 'held' OR hold_expires_at IS NULL)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL UNIQUE,
  show_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_show_seat_fk FOREIGN KEY (show_id, seat_id)
    REFERENCES show_seats(show_id, seat_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS shows_starts_at_idx ON shows(starts_at);
CREATE INDEX IF NOT EXISTS show_seats_show_status_idx ON show_seats(show_id, status);
CREATE INDEX IF NOT EXISTS show_seats_hold_expiry_idx ON show_seats(hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_show_status_idx ON bookings(show_id, status);
CREATE INDEX IF NOT EXISTS bookings_seat_idx ON bookings(seat_id);
