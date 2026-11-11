import { Router } from "express";
import {
  createGetShowSeatsHandler,
  createListShowsHandler,
} from "../controllers/shows.controller.js";
import { createReservationsRouter } from "./reservations.js";

export function createShowsRouter({ database }) {
  const router = Router();
  router.get("/", createListShowsHandler({ database }));
  router.get("/:showId/seats", createGetShowSeatsHandler({ database }));
  router.use("/:showId/reservations", createReservationsRouter({ database }));
  return router;
}
