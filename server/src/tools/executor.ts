import { calculateRemainingBudget } from "app/tools/budget.tool.js";
import { getDestinationInfo } from "app/tools/destination.tool.js";
import { searchExperiences } from "app/tools/experiences.tool.js";
import { searchFlights } from "app/tools/flights.tool.js";
import { searchHotels } from "app/tools/hotels.tool.js";
import { logger } from "app/utils/logs/logger.js";

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  logger.debug({ toolName, input }, "Executing tool");

  switch (toolName) {
    case "search_flights":
      return searchFlights(input as Parameters<typeof searchFlights>[0]);

    case "search_hotels":
      return searchHotels(input as Parameters<typeof searchHotels>[0]);

    case "search_experiences":
      return searchExperiences(input as Parameters<typeof searchExperiences>[0]);

    case "calculate_remaining_budget":
      return calculateRemainingBudget(input as Parameters<typeof calculateRemainingBudget>[0]);

    case "get_destination_info":
      return getDestinationInfo(input as Parameters<typeof getDestinationInfo>[0]);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
