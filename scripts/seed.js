import "dotenv/config";
import {
  closeDatabase,
  getDatabaseConfig,
  pool,
} from "../src/config/database.js";
import { logger } from "../src/config/logger.js";

getDatabaseConfig();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  await client.query(`
    INSERT INTO seats (seat_number, seat_type) VALUES
      ('A1', 'standard'), ('A2', 'standard'), ('A3', 'standard'), ('A4', 'standard'),
      ('B1', 'premium'), ('B2', 'premium'), ('B3', 'premium'), ('B4', 'premium'),
      ('C1', 'accessible')
    ON CONFLICT (seat_number) DO NOTHING
  `);

  await client.query(`
    INSERT INTO shows (movie_title, screen_name, starts_at) VALUES
      ('The Last Horizon', 'Screen 1', date_trunc('day', now()) + interval '2 days 18 hours'),
      ('The Last Horizon', 'Screen 1', date_trunc('day', now()) + interval '2 days 21 hours'),
      ('Paper Moons', 'Screen 2', date_trunc('day', now()) + interval '3 days 19 hours')
    ON CONFLICT (movie_title, screen_name, starts_at) DO NOTHING
  `);

  await client.query(`
    INSERT INTO show_seats (show_id, seat_id)
    SELECT shows.id, seats.id
    FROM shows CROSS JOIN seats
    WHERE shows.movie_title IN ('The Last Horizon', 'Paper Moons')
      AND shows.starts_at >= date_trunc('day', now()) + interval '2 days'
      AND shows.starts_at < date_trunc('day', now()) + interval '4 days'
    ON CONFLICT (show_id, seat_id) DO NOTHING
  `);

  await client.query("COMMIT");
  logger.info("Cinema sample data seeded (existing records retained)");
} catch {
  await client.query("ROLLBACK");
  logger.error(
    "Database seed failed; verify migrations and PostgreSQL configuration",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await closeDatabase();
}
