import "dotenv/config";
import { app } from "./app.js";
import { logger } from "./config/logger.js";
import { closeDatabase } from "./config/database.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = app.listen(port, host, () =>
  logger.info({ host, port }, "Cinema Ticketing API listening"),
);

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  const timeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(async (error) => {
    clearTimeout(timeout);
    if (error) {
      logger.error({ err: error }, "HTTP server failed to close cleanly");
      process.exitCode = 1;
    }
    try {
      await closeDatabase();
    } catch {
      logger.error("PostgreSQL pool failed to close cleanly");
      process.exitCode = 1;
    }
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
