export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_flights",
    description:
      "Search for flight offers between two airports. Returns up to 5 options sorted by price. Use IATA airport codes (e.g., SFO, BCN, JFK). If you only have a city name, call get_destination_info first to resolve the IATA code.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin IATA airport code (e.g., SFO)" },
        destination: {
          type: "string",
          description: "Destination IATA airport code (e.g., BCN)",
        },
        departure_date: {
          type: "string",
          description: "Departure date in YYYY-MM-DD format",
        },
        return_date: {
          type: "string",
          description: "Return date in YYYY-MM-DD format (optional for one-way)",
        },
        passengers: { type: "number", description: "Number of adult passengers" },
        max_price: {
          type: "number",
          description: "Maximum price per person in USD (optional)",
        },
        cabin_class: {
          type: "string",
          description: "Cabin class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST (optional)",
          enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
        },
      },
      required: ["origin", "destination", "departure_date", "passengers"],
    },
  },
  {
    name: "search_hotels",
    description:
      "Search for hotel offers in a city. Returns up to 5 options sorted by price. Use IATA city codes. Call get_destination_info first to resolve city names to codes.",
    input_schema: {
      type: "object",
      properties: {
        city_code: { type: "string", description: "IATA city code (e.g., BCN, PAR, LON)" },
        check_in: { type: "string", description: "Check-in date in YYYY-MM-DD format" },
        check_out: { type: "string", description: "Check-out date in YYYY-MM-DD format" },
        guests: { type: "number", description: "Number of guests" },
        star_rating_min: {
          type: "number",
          description: "Minimum star rating 1-5 (optional)",
        },
        max_price_per_night: {
          type: "number",
          description: "Maximum price per night in USD (optional)",
        },
      },
      required: ["city_code", "check_in", "check_out", "guests"],
    },
  },
  {
    name: "search_experiences",
    description:
      "Search for activities, tours, restaurants, and experiences at a destination. Uses Google Places to find highly-rated options matching the specified categories.",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City or area name (e.g., Barcelona, Paris 6th arrondissement)",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description:
            "Activity categories to search for (e.g., ['museum', 'cooking class', 'wine tasting'])",
        },
        max_price_per_person: {
          type: "number",
          description: "Maximum estimated cost per person in USD (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 5)",
        },
      },
      required: ["location", "categories"],
    },
  },
  {
    name: "calculate_remaining_budget",
    description:
      "Calculate how much budget remains after flights, hotels, and experiences. Always use this tool instead of doing math yourself. Call it after selecting each major booking category.",
    input_schema: {
      type: "object",
      properties: {
        total_budget: { type: "number", description: "Total trip budget in USD" },
        flight_cost: {
          type: "number",
          description: "Total cost of selected flights (0 if none selected yet)",
        },
        hotel_total_cost: {
          type: "number",
          description: "Total hotel cost for entire stay (0 if none selected yet)",
        },
        experience_costs: {
          type: "array",
          items: { type: "number" },
          description: "Array of individual experience costs (empty array if none selected yet)",
        },
      },
      required: ["total_budget", "flight_cost", "hotel_total_cost", "experience_costs"],
    },
  },
  {
    name: "get_destination_info",
    description:
      "Look up IATA airport code, country, timezone, currency, and best time to visit for a city. Use this to resolve city names to IATA codes before calling search_flights or search_hotels.",
    input_schema: {
      type: "object",
      properties: {
        city_name: {
          type: "string",
          description: "City name (e.g., Barcelona, San Francisco, Tokyo)",
        },
      },
      required: ["city_name"],
    },
  },
];
