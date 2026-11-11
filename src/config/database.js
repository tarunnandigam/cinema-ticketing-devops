import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg;

export function getDatabaseConfig(env = process.env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  return {
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
    application_name: "cinema-ticketing-api",
  };
}

const poolOptions = process.env.DATABASE_URL
  ? getDatabaseConfig()
  : { connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000, max: 10 };

export const pool = new Pool(poolOptions);

pool.on("error", () => {
  // Do not log the driver error object: it can contain connection details.
  logger.error("Unexpected PostgreSQL pool error");
});

export async function closeDatabase() {
  await pool.end();
}

export const database = {
  query(...args) {
    getDatabaseConfig();
    return pool.query(...args);
  },
  connect() {
    getDatabaseConfig();
    return pool.connect();
  },
};

export async function checkDatabase(connection = database) {
  await connection.query("SELECT 1");
}
