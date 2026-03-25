import { updateTrip, type UpdateTripInput } from "app/repositories/trips/trips.js";
import { calculateRemainingBudget } from "app/tools/budget.tool.js";
import { getDestinationInfo } from "app/tools/destination.tool.js";
import { searchExperiences } from "app/tools/experiences.tool.js";
import { searchFlights } from "app/tools/flights.tool.js";
import { searchHotels } from "app/tools/hotels.tool.js";
import { logger } from "app/utils/logs/logger.js";

export interface ToolContext {
  tripId: string;
  userId: string;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: ToolContext,
): Promise<unknown> {
  logger.debug({ toolName, input }, "Executing tool");

  switch (toolName) {
    case "search_flights":
      return searchFlights(input as unknown as Parameters<typeof searchFlights>[0]);

    case "search_hotels":
      return searchHotels(input as unknown as Parameters<typeof searchHotels>[0]);

    case "search_experiences":
      return searchExperiences(input as unknown as Parameters<typeof searchExperiences>[0]);

    case "calculate_remaining_budget":
      return calculateRemainingBudget(
        input as unknown as Parameters<typeof calculateRemainingBudget>[0],
      );

    case "get_destination_info":
      return getDestinationInfo(input as unknown as Parameters<typeof getDestinationInfo>[0]);

    case "update_trip": {
      if (!context) throw new Error("update_trip requires trip context");
      const updated = await updateTrip(context.tripId, context.userId, input as UpdateTripInput);
      return updated
        ? { success: true, message: "Trip updated successfully" }
        : { success: false, message: "No fields to update" };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
