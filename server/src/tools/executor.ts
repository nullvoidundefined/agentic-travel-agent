import {
  insertTripCarRental,
  insertTripExperience,
  insertTripFlight,
  insertTripHotel,
  updateTrip,
} from 'app/repositories/trips/trips.js';
import { calculateRemainingBudget } from 'app/tools/budget.tool.js';
import { searchCarRentals } from 'app/tools/car-rentals.tool.js';
import { getDestinationInfo } from 'app/tools/destination.tool.js';
import { searchExperiences } from 'app/tools/experiences.tool.js';
import { searchFlights } from 'app/tools/flights.tool.js';
import { searchHotels } from 'app/tools/hotels.tool.js';
import {
  calculateBudgetSchema,
  formatResponseSchema,
  getDestinationInfoSchema,
  searchCarRentalsSchema,
  searchExperiencesSchema,
  searchFlightsSchema,
  searchHotelsSchema,
  selectCarRentalSchema,
  selectExperienceSchema,
  selectFlightSchema,
  selectHotelSchema,
  updateTripSchema,
} from 'app/tools/schemas.js';
import { logger } from 'app/utils/logs/logger.js';
import type { ZodError, ZodSchema } from 'zod';

export interface ToolContext {
  tripId: string;
  userId: string;
  requestId?: string;
}

/**
 * ENG-04 (2026-04-06 audit): adapter seam for the five external-API
 * tool implementations. Passing a ToolAdapters object into executeTool
 * swaps the real SerpApi / Google Places / destination-info clients
 * for test doubles at per-tool granularity. Plan B's E2E harness uses
 * this to mock flights and hotels deterministically without env-global
 * flags.
 */
export interface ToolAdapters {
  searchFlights: typeof searchFlights;
  searchHotels: typeof searchHotels;
  searchExperiences: typeof searchExperiences;
  searchCarRentals: typeof searchCarRentals;
  getDestinationInfo: typeof getDestinationInfo;
}

export const DEFAULT_TOOL_ADAPTERS: ToolAdapters = {
  searchFlights,
  searchHotels,
  searchExperiences,
  searchCarRentals,
  getDestinationInfo,
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

function parseInput<T>(
  toolName: string,
  schema: ZodSchema<T>,
  input: Record<string, unknown>,
): { data: T } | { error: string } {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = formatZodError(result.error);
    logger.warn(
      { toolName, issues: result.error.issues },
      'Tool input validation failed',
    );
    return {
      error: `Validation failed for ${toolName}: ${details}. Please fix the input and try again.`,
    };
  }
  return { data: result.data };
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: ToolContext,
  adapters: ToolAdapters = DEFAULT_TOOL_ADAPTERS,
): Promise<unknown> {
  logger.debug({ toolName, input }, 'Executing tool');

  switch (toolName) {
    case 'search_flights': {
      const parsed = parseInput(toolName, searchFlightsSchema, input);
      if ('error' in parsed) return parsed;
      return adapters.searchFlights(parsed.data);
    }

    case 'search_hotels': {
      const parsed = parseInput(toolName, searchHotelsSchema, input);
      if ('error' in parsed) return parsed;
      return adapters.searchHotels(parsed.data);
    }

    case 'search_experiences': {
      const parsed = parseInput(toolName, searchExperiencesSchema, input);
      if ('error' in parsed) return parsed;
      return adapters.searchExperiences(parsed.data);
    }

    case 'calculate_remaining_budget': {
      const parsed = parseInput(toolName, calculateBudgetSchema, input);
      if ('error' in parsed) return parsed;
      return calculateRemainingBudget(parsed.data);
    }

    case 'get_destination_info': {
      const parsed = parseInput(toolName, getDestinationInfoSchema, input);
      if ('error' in parsed) return parsed;
      return adapters.getDestinationInfo(parsed.data);
    }

    case 'update_trip': {
      if (!context) throw new Error('update_trip requires trip context');
      const parsed = parseInput(toolName, updateTripSchema, input);
      if ('error' in parsed) return parsed;
      const updated = await updateTrip(
        context.tripId,
        context.userId,
        parsed.data,
      );
      return updated
        ? { success: true, message: 'Trip updated successfully' }
        : { success: false, message: 'No fields to update' };
    }

    case 'search_car_rentals': {
      const parsed = parseInput(toolName, searchCarRentalsSchema, input);
      if ('error' in parsed) return parsed;
      return adapters.searchCarRentals(parsed.data);
    }

    case 'select_flight': {
      if (!context) throw new Error('select_flight requires trip context');
      const parsed = parseInput(toolName, selectFlightSchema, input);
      if ('error' in parsed) return parsed;
      await insertTripFlight(context.tripId, parsed.data);
      return { success: true, message: 'Flight selection saved' };
    }

    case 'select_hotel': {
      if (!context) throw new Error('select_hotel requires trip context');
      const parsed = parseInput(toolName, selectHotelSchema, input);
      if ('error' in parsed) return parsed;
      await insertTripHotel(context.tripId, parsed.data);
      return { success: true, message: 'Hotel selection saved' };
    }

    case 'select_car_rental': {
      if (!context) throw new Error('select_car_rental requires trip context');
      const parsed = parseInput(toolName, selectCarRentalSchema, input);
      if ('error' in parsed) return parsed;
      await insertTripCarRental(context.tripId, parsed.data);
      return { success: true, message: 'Car rental selection saved' };
    }

    case 'select_experience': {
      if (!context) throw new Error('select_experience requires trip context');
      const parsed = parseInput(toolName, selectExperienceSchema, input);
      if ('error' in parsed) return parsed;
      await insertTripExperience(context.tripId, parsed.data);
      return { success: true, message: 'Experience selection saved' };
    }

    case 'format_response': {
      const parsed = parseInput(toolName, formatResponseSchema, input);
      if ('error' in parsed) return parsed;
      return parsed.data;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
