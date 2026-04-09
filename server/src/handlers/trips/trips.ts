import { DEFAULT_COMPLETION_TRACKER } from 'app/prompts/booking-steps.js';
import {
  getOrCreateConversation,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import { createTripSchema } from 'app/schemas/trips.js';
import {
  selectCarRentalSchema,
  selectExperienceSchema,
  selectFlightSchema,
  selectHotelSchema,
} from 'app/tools/schemas.js';
import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';
import type { ZodError } from 'zod';

function formatZodError(error: ZodError): string {
  return error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
}

export async function createTrip(req: Request, res: Response): Promise<void> {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    throw ApiError.badRequest(message);
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
    throw ApiError.notFound('Trip not found');
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

  if (departure_date !== undefined) {
    const today = new Date().toISOString().split('T')[0] as string;
    if (departure_date < today) {
      throw ApiError.badRequest('Departure date cannot be in the past');
    }
  }

  if (return_date !== undefined && departure_date !== undefined) {
    if (return_date < departure_date) {
      throw ApiError.badRequest('Return date must be after departure date');
    }
  }

  if (Object.keys(input).length === 0) {
    throw ApiError.badRequest('No fields to update');
  }

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
    throw ApiError.notFound('Trip not found');
  }

  if (shouldClearSelections) {
    await tripRepo.clearSelectionsForTrip(tripId);
    const conversation = await getOrCreateConversation(tripId);
    await updateBookingState(
      conversation.id,
      DEFAULT_COMPLETION_TRACKER as unknown as Record<string, unknown>,
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
    throw ApiError.notFound('Trip not found');
  }

  logger.info({ event: 'trip_deleted', tripId, userId }, 'Trip deleted');
  res.status(204).send();
}

/**
 * B14: persist a tile-card selection (flight, hotel, car rental, or
 * experience) directly from the frontend. This bypasses the agent loop so
 * selection persistence is deterministic and does not depend on the LLM
 * extracting structured data from a natural-language confirmation message.
 *
 * The agent sees the updated selections in the trip context on the next turn
 * via getTripWithDetails, so it can acknowledge them naturally.
 */
export async function selectItem(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id as string;
  const { type, data } = (req.body ?? {}) as {
    type?: string;
    data?: Record<string, unknown>;
  };

  if (!data || typeof data !== 'object') {
    throw ApiError.badRequest('data is required');
  }

  const trip = await tripRepo.getTripWithDetails(tripId, userId);
  if (!trip) throw ApiError.notFound('Trip not found');

  switch (type) {
    case 'flight': {
      const parsed = selectFlightSchema.safeParse(data);
      if (!parsed.success)
        throw ApiError.badRequest(formatZodError(parsed.error));
      await tripRepo.insertTripFlight(
        tripId,
        parsed.data as Record<string, unknown>,
      );
      break;
    }
    case 'hotel': {
      const parsed = selectHotelSchema.safeParse(data);
      if (!parsed.success)
        throw ApiError.badRequest(formatZodError(parsed.error));
      await tripRepo.insertTripHotel(
        tripId,
        parsed.data as Record<string, unknown>,
      );
      break;
    }
    case 'car_rental': {
      const parsed = selectCarRentalSchema.safeParse(data);
      if (!parsed.success)
        throw ApiError.badRequest(formatZodError(parsed.error));
      await tripRepo.insertTripCarRental(
        tripId,
        parsed.data as Record<string, unknown>,
      );
      break;
    }
    case 'experience': {
      const parsed = selectExperienceSchema.safeParse(data);
      if (!parsed.success)
        throw ApiError.badRequest(formatZodError(parsed.error));
      await tripRepo.insertTripExperience(
        tripId,
        parsed.data as Record<string, unknown>,
      );
      break;
    }
    default:
      throw ApiError.badRequest(
        `Invalid selection type: ${String(type)}. Must be flight, hotel, car_rental, or experience.`,
      );
  }

  logger.info(
    { event: 'selection_saved', tripId, userId, type },
    'Trip selection saved',
  );
  res.status(201).json({ success: true });
}

/**
 * Test-only seam: insert flight / hotel / car-rental / experience
 * selections directly via the repository functions, bypassing the
 * agent loop.
 *
 * ENG-17: E2E tests for US-23, US-26, and US-27 need a trip that
 * has selections already in place BEFORE the test runs. Going
 * through the real chat flow would require a multi-turn
 * MockAnthropic state machine and would couple the tests to the
 * agent loop. This endpoint provides a deterministic alternative
 * that reuses the same repo functions the real select_* tools
 * call.
 *
 * The handler returns 404 unless E2E_BYPASS_RATE_LIMITS=1 is set,
 * which means the endpoint is invisible in production. The env
 * flag is the same one playwright.config.ts and
 * src/__integration__/setup.ts already set for test mode.
 *
 * Payload shape mirrors the select_* tool schemas. See
 * selectFlightSchema, selectHotelSchema, etc. in src/tools/schemas.ts.
 */
export async function seedSelections(
  req: Request,
  res: Response,
): Promise<void> {
  if (process.env.E2E_BYPASS_RATE_LIMITS !== '1') {
    throw ApiError.notFound('Not found');
  }

  const userId = req.user!.id;
  const tripId = req.params.id as string;

  // Ownership check: ensure the caller owns this trip.
  const trip = await tripRepo.getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.notFound('Trip not found');
  }

  const {
    flights = [],
    hotels = [],
    car_rentals = [],
    experiences = [],
  } = (req.body ?? {}) as {
    flights?: Record<string, unknown>[];
    hotels?: Record<string, unknown>[];
    car_rentals?: Record<string, unknown>[];
    experiences?: Record<string, unknown>[];
  };

  for (const flight of flights) {
    await tripRepo.insertTripFlight(tripId, flight);
  }
  for (const hotel of hotels) {
    await tripRepo.insertTripHotel(tripId, hotel);
  }
  for (const rental of car_rentals) {
    await tripRepo.insertTripCarRental(tripId, rental);
  }
  for (const experience of experiences) {
    await tripRepo.insertTripExperience(tripId, experience);
  }

  logger.info(
    {
      event: 'trip_selections_seeded',
      tripId,
      userId,
      flightCount: flights.length,
      hotelCount: hotels.length,
      carRentalCount: car_rentals.length,
      experienceCount: experiences.length,
    },
    'Test-only trip selections seeded',
  );
  res.status(204).send();
}
