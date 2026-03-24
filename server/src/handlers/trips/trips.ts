import type { Request, Response } from "express";

import * as tripRepo from "app/repositories/trips/trips.js";
import { createTripSchema } from "app/schemas/trips.js";
import { logger } from "app/utils/logs/logger.js";

export async function createTrip(req: Request, res: Response): Promise<void> {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join("; ");
    res.status(400).json({ error: { message } });
    return;
  }

  const userId = req.user!.id;
  const trip = await tripRepo.createTrip(userId, parsed.data);
  logger.info({ event: "trip_created", tripId: trip.id, userId }, "Trip created");
  res.status(201).json({ trip });
}

export async function listTrips(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const trips = await tripRepo.listTrips(userId);
  res.json({ trips });
}

export async function getTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id;

  const trip = await tripRepo.getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: { message: "Trip not found" } });
    return;
  }

  res.json({ trip });
}

export async function deleteTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id;

  const deleted = await tripRepo.deleteTrip(tripId, userId);
  if (!deleted) {
    res.status(404).json({ error: { message: "Trip not found" } });
    return;
  }

  logger.info({ event: "trip_deleted", tripId, userId }, "Trip deleted");
  res.status(204).send();
}
