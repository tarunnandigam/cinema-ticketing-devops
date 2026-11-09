import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./config/logger.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.get("/ready", (_req, res) =>
  res.status(503).json({
    status: "not_ready",
    checks: { database: "not_configured" },
  }),
);

app.get("/api/v1", (_req, res) =>
  res.status(200).json({
    name: "cinema-ticketing-api",
    version: "v1",
    status: "available",
  }),
);

export { app };
