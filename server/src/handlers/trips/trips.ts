import { DEFAULT_BOOKING_STATE } from 'app/prompts/booking-steps.js';
import {
  getOrCreateConversation,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import { createTripSchema } from 'app/schemas/trips.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

export async function createTrip(req: Request, res: Response): Promise<void> {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: 'VALIDATION_ERROR', message });
    return;
  }

  const userId = req.user!.id;
  const trip = await tripRepo.createTrip(userId, parsed.data);
  logger.info(
    { event: 'trip_created', tripId: trip.id, userId },
    'Trip created',
  );
  res.status(201).json({ trip });
}

export async function listTrips(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const trips = await tripRepo.listTrips(userId);
  res.json({ trips });
}

export async function getTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id as string;

  const trip = await tripRepo.getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  res.json({ trip });
}

export async function updateTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id as string;

  const {
    destination,
    origin,
    departure_date,
    return_date,
    budget_total,
    travelers,
    transport_mode,
    trip_type,
    status,
  } = req.body ?? {};
  const input: Record<string, unknown> = {};
  if (destination !== undefined) input.destination = destination;
  if (origin !== undefined) input.origin = origin;
  if (departure_date !== undefined) input.departure_date = departure_date;
  if (return_date !== undefined) input.return_date = return_date;
  if (budget_total !== undefined) input.budget_total = budget_total;
  if (travelers !== undefined) input.travelers = travelers;
  if (transport_mode !== undefined) input.transport_mode = transport_mode;
  if (trip_type !== undefined) input.trip_type = trip_type;
  if (status !== undefined) input.status = status;

  // Date validation
  if (departure_date !== undefined) {
    const today = new Date().toISOString().split('T')[0] as string;
    if (departure_date < today) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Departure date cannot be in the past',
      });
      return;
    }
  }

  if (return_date !== undefined && departure_date !== undefined) {
    if (return_date < departure_date) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Return date must be after departure date',
      });
      return;
    }
  }

  if (Object.keys(input).length === 0) {
    res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', message: 'No fields to update' });
    return;
  }

  // Check if destination is changing — need to clear selections
  let shouldClearSelections = false;
  if (destination !== undefined) {
    const existingTrip = await tripRepo.getTripWithDetails(tripId, userId);
    if (
      existingTrip &&
      existingTrip.destination &&
      existingTrip.destination !== destination
    ) {
      const hasSelections =
        (existingTrip.flights?.length ?? 0) > 0 ||
        (existingTrip.hotels?.length ?? 0) > 0 ||
        (existingTrip.car_rentals?.length ?? 0) > 0 ||
        (existingTrip.experiences?.length ?? 0) > 0;
      if (hasSelections) {
        shouldClearSelections = true;
      }
    }
  }

  const trip = await tripRepo.updateTrip(
    tripId,
    userId,
    input as tripRepo.UpdateTripInput,
  );
  if (!trip) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  if (shouldClearSelections) {
    await tripRepo.clearSelectionsForTrip(tripId);
    const conversation = await getOrCreateConversation(tripId);
    await updateBookingState(
      conversation.id,
      DEFAULT_BOOKING_STATE as unknown as Record<string, unknown>,
    );
    logger.info(
      { event: 'selections_cleared', tripId, newDestination: destination },
      'Cleared selections after destination change',
    );
  }

  logger.info({ event: 'trip_updated', tripId, userId }, 'Trip updated');
  res.json({ trip });
}

export async function deleteTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id as string;

  const deleted = await tripRepo.deleteTrip(tripId, userId);
  if (!deleted) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  logger.info({ event: 'trip_deleted', tripId, userId }, 'Trip deleted');
  res.status(204).send();
}
