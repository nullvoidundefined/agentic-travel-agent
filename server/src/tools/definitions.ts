export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_flights',
    description:
      'Search for flight offers between two airports. Returns up to 5 options sorted by price. Use IATA airport codes (e.g., SFO, BCN, JFK). If you only have a city name, call get_destination_info first to resolve the IATA code.',
    input_schema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin IATA airport code (e.g., SFO)',
        },
        destination: {
          type: 'string',
          description: 'Destination IATA airport code (e.g., BCN)',
        },
        departure_date: {
          type: 'string',
          description: 'Departure date in YYYY-MM-DD format',
        },
        return_date: {
          type: 'string',
          description:
            'Return date in YYYY-MM-DD format (optional for one-way)',
        },
        passengers: {
          type: 'number',
          description: 'Number of adult passengers',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price per person in USD (optional)',
        },
        cabin_class: {
          type: 'string',
          description:
            'Cabin class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST (optional)',
          enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
        },
      },
      required: ['origin', 'destination', 'departure_date', 'passengers'],
    },
  },
  {
    name: 'search_hotels',
    description:
      'Search for hotel offers in a city. Returns up to 5 options sorted by price. Use a city name (e.g., Barcelona, Paris).',
    input_schema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g., Barcelona, Paris, Tokyo)',
        },
        check_in: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format',
        },
        check_out: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format',
        },
        guests: { type: 'number', description: 'Number of guests' },
        star_rating_min: {
          type: 'number',
          description: 'Minimum star rating 1-5 (optional)',
        },
        max_price_per_night: {
          type: 'number',
          description: 'Maximum price per night in USD (optional)',
        },
      },
      required: ['city', 'check_in', 'check_out', 'guests'],
    },
  },
  {
    name: 'search_experiences',
    description:
      'Search for activities, tours, restaurants, and experiences at a destination. Uses Google Places to find highly-rated options matching the specified categories.',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'City or area name (e.g., Barcelona, Paris 6th arrondissement)',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Activity categories to search for (e.g., ['museum', 'cooking class', 'wine tasting'])",
        },
        max_price_per_person: {
          type: 'number',
          description: 'Maximum estimated cost per person in USD (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 5)',
        },
      },
      required: ['location', 'categories'],
    },
  },
  {
    name: 'calculate_remaining_budget',
    description:
      'Calculate how much budget remains after flights, hotels, and experiences. Always use this tool instead of doing math yourself. Call it after selecting each major booking category.',
    input_schema: {
      type: 'object',
      properties: {
        total_budget: {
          type: 'number',
          description: 'Total trip budget in USD',
        },
        flight_cost: {
          type: 'number',
          description:
            'Total cost of selected flights (0 if none selected yet)',
        },
        hotel_total_cost: {
          type: 'number',
          description:
            'Total hotel cost for entire stay (0 if none selected yet)',
        },
        experience_costs: {
          type: 'array',
          items: { type: 'number' },
          description:
            'Array of individual experience costs (empty array if none selected yet)',
        },
      },
      required: [
        'total_budget',
        'flight_cost',
        'hotel_total_cost',
        'experience_costs',
      ],
    },
  },
  {
    name: 'update_trip',
    description:
      "Update the current trip's destination, dates, and/or budget. Call this as soon as the user's destination, travel dates, or budget are determined from the conversation. This persists the information so the trip card shows real details instead of placeholders.",
    input_schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Trip destination city name (e.g., Barcelona, Tokyo)',
        },
        origin: {
          type: 'string',
          description: 'Trip origin city name (optional)',
        },
        departure_date: {
          type: 'string',
          description: 'Departure date in YYYY-MM-DD format (optional)',
        },
        return_date: {
          type: 'string',
          description: 'Return date in YYYY-MM-DD format (optional)',
        },
        budget_total: {
          type: 'number',
          description: 'Total trip budget in USD (optional)',
        },
        transport_mode: {
          type: 'string',
          enum: ['flying', 'driving'],
          description:
            'How the user is getting to their destination. Set when the user says they will fly or drive.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_destination_info',
    description:
      'Look up IATA airport code, country, timezone, currency, and best time to visit for a city. Use this to resolve city names to IATA codes before calling search_flights or search_hotels.',
    input_schema: {
      type: 'object',
      properties: {
        city_name: {
          type: 'string',
          description: 'City name (e.g., Barcelona, San Francisco, Tokyo)',
        },
      },
      required: ['city_name'],
    },
  },
  {
    name: 'search_car_rentals',
    description:
      'Search for car rental options at a destination. Returns available cars with pricing, features, and pickup/dropoff details.',
    input_schema: {
      type: 'object',
      properties: {
        pickup_location: {
          type: 'string',
          description: 'City or airport for car pickup (e.g. "Tokyo" or "NRT")',
        },
        pickup_date: {
          type: 'string',
          description: 'Pickup date in YYYY-MM-DD format',
        },
        dropoff_date: {
          type: 'string',
          description: 'Dropoff date in YYYY-MM-DD format',
        },
        dropoff_location: {
          type: 'string',
          description:
            'City or airport for dropoff. Defaults to pickup location if omitted.',
        },
        car_type: {
          type: 'string',
          description:
            'Preferred car type: economy, compact, midsize, suv, luxury, van',
        },
      },
      required: ['pickup_location', 'pickup_date', 'dropoff_date'],
    },
  },
  {
    name: 'select_flight',
    description:
      "Persist the user's selected flight to the trip. Call this when the user confirms a flight choice.",
    input_schema: {
      type: 'object',
      properties: {
        airline: { type: 'string' },
        flight_number: { type: 'string' },
        origin: { type: 'string' },
        destination: { type: 'string' },
        departure_time: { type: 'string' },
        arrival_time: { type: 'string' },
        price: { type: 'number' },
        currency: { type: 'string' },
      },
      required: [
        'airline',
        'flight_number',
        'origin',
        'destination',
        'price',
        'currency',
      ],
    },
  },
  {
    name: 'select_hotel',
    description:
      "Persist the user's selected hotel to the trip. Call this when the user confirms a hotel choice.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        city: { type: 'string' },
        star_rating: { type: 'number' },
        price_per_night: { type: 'number' },
        total_price: { type: 'number' },
        currency: { type: 'string' },
        check_in: { type: 'string' },
        check_out: { type: 'string' },
      },
      required: ['name', 'price_per_night', 'total_price', 'currency'],
    },
  },
  {
    name: 'select_car_rental',
    description: "Persist the user's selected car rental to the trip.",
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        car_name: { type: 'string' },
        car_type: { type: 'string' },
        price_per_day: { type: 'number' },
        total_price: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['provider', 'car_name', 'total_price', 'currency'],
    },
  },
  {
    name: 'select_experience',
    description: "Persist the user's selected experience to the trip.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string' },
        estimated_cost: { type: 'number' },
        rating: { type: 'number' },
      },
      required: ['name', 'estimated_cost'],
    },
  },
  {
    name: 'format_response',
    description:
      'REQUIRED: Call this as your LAST tool call every turn. Provides your text response, citations, suggested quick replies, and optional advisory escalation. Do NOT write text outside of this tool — all your text goes in the text field.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Your markdown-formatted response text to the user.',
        },
        citations: {
          type: 'array',
          description:
            'References backing claims in your text. Each citation needs an id (e.g. "1"), label (display text), and either a url (external link) or source_type.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              url: { type: 'string' },
              source_type: {
                type: 'string',
                enum: [
                  'travel_advisory',
                  'visa_info',
                  'weather',
                  'vaccination',
                  'general',
                ],
              },
            },
            required: ['id', 'label'],
          },
        },
        quick_replies: {
          type: 'array',
          description:
            'Suggested next actions for the user (2-4 short options). Only include when there are clear next steps.',
          items: { type: 'string' },
        },
        advisory: {
          type: 'object',
          description:
            'Escalated travel advisory when you detect contextual risk factors (e.g. families traveling to high-risk areas, health concerns). Only use when auto-enrichment baseline is insufficient.',
          properties: {
            severity: {
              type: 'string',
              enum: ['info', 'warning', 'critical'],
            },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['severity', 'title', 'body'],
        },
        skip_category: {
          type: 'boolean',
          description:
            'Set to true when the user declines the current category (e.g., "No, I don\'t need a hotel"). The system will skip this category and move to the next.',
        },
      },
      required: ['text'],
    },
  },
];
