import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDatabaseConfig,
  pool,
  closeDatabase,
} from "../src/config/database.js";
import { logger } from "../src/config/logger.js";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../database/migrations",
);
getDatabaseConfig();
const client = await pool.connect();
const advisoryLockId = 842_610_318;

try {
  await client.query("SELECT pg_advisory_lock($1)", [advisoryLockId]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await client.query(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(appliedResult.rows.map(({ name }) => name));
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      logger.info({ migration: file }, "Database migration applied");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  logger.info("Database migrations are up to date");
} catch (error) {
  if (
    error?.code === "P0001" &&
    typeof error.message === "string" &&
    error.message.startsWith("ACTIVE_BOOKING_DUPLICATES:")
  ) {
    logger.error(
      { migrationError: error.message },
      "Database migration stopped",
    );
  } else {
    logger.error(
      "Database migration failed; inspect PostgreSQL and migration SQL configuration",
    );
  }
  process.exitCode = 1;
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock($1)", [advisoryLockId]);
  } catch {
    // The connection may already be broken; do not expose driver connection details.
  }
  client.release();
  await closeDatabase();
}
