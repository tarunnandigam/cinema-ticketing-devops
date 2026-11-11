import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./config/logger.js";
import {
  checkDatabase,
  database as defaultDatabase,
} from "./config/database.js";
import { createShowsRouter } from "./routes/shows.js";
import { createCancellationsRouter } from "./routes/cancellations.js";

function createApp({ database = defaultDatabase } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.get("/ready", async (_req, res) => {
    try {
      await checkDatabase(database);
      return res.status(200).json({
        status: "ready",
        checks: { database: "ok" },
      });
    } catch {
      logger.warn("Database readiness check failed");
      return res.status(503).json({
        status: "not_ready",
        checks: { database: "unavailable" },
      });
    }
  });

  app.get("/api/v1", (_req, res) =>
    res.status(200).json({
      name: "cinema-ticketing-api",
      version: "v1",
      status: "available",
    }),
  );

  app.use("/api/v1/shows", createShowsRouter({ database }));
  app.use("/api/v1/reservations", createCancellationsRouter({ database }));

  return app;
}

const app = createApp();

export { app, createApp };
