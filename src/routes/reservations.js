import { Router } from "express";
import { createReservationHandler } from "../controllers/reservations.controller.js";

export function createReservationsRouter({ database }) {
  const router = Router({ mergeParams: true });
  router.post("/", createReservationHandler({ database }));
  return router;
}
