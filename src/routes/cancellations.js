import { Router } from "express";
import { createCancellationHandler } from "../controllers/cancellations.controller.js";

export function createCancellationsRouter({ database }) {
  const router = Router();
  router.delete("/:bookingId", createCancellationHandler({ database }));
  return router;
}
