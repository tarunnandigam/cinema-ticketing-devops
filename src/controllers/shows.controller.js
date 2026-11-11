import { logger } from "../config/logger.js";

const LIST_SHOWS_QUERY = `
  SELECT id, movie_title, screen_name, starts_at
  FROM shows
  ORDER BY starts_at ASC
`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIND_SHOW_QUERY = `
  SELECT id
  FROM shows
  WHERE id = $1
`;

const LIST_SHOW_SEATS_QUERY = `
  SELECT
    seats.id AS seat_id,
    seats.seat_number,
    show_seats.status
  FROM show_seats
  INNER JOIN seats ON seats.id = show_seats.seat_id
  WHERE show_seats.show_id = $1
  ORDER BY seats.seat_number ASC
`;

export function createListShowsHandler({ database }) {
  return async (_req, res) => {
    try {
      const { rows } = await database.query(LIST_SHOWS_QUERY);
      return res.status(200).json({ shows: rows });
    } catch {
      logger.error("Failed to retrieve cinema shows");
      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve shows",
      });
    }
  };
}

export function createGetShowSeatsHandler({ database }) {
  return async (req, res) => {
    const { showId } = req.params;

    if (!UUID_PATTERN.test(showId)) {
      return res.status(400).json({
        status: "error",
        message: "showId must be a valid UUID",
      });
    }

    try {
      const showResult = await database.query(FIND_SHOW_QUERY, [showId]);
      if (showResult.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "Show not found",
        });
      }

      const { rows } = await database.query(LIST_SHOW_SEATS_QUERY, [showId]);
      return res.status(200).json({ showId, seats: rows });
    } catch {
      logger.error({ showId }, "Failed to retrieve cinema show seat map");
      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve show seats",
      });
    }
  };
}
