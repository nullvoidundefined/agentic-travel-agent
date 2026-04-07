import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache.service.js';
import {
  SerpApiQuotaExceededError,
  serpApiGet,
} from 'app/services/serpapi.service.js';
import { generateMockFlights } from 'app/tools/mock/flights.mock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';
import { logger } from 'app/utils/logs/logger.js';

// FIN-07: extended from 1h to 6h on 2026-04-06. The SerpApi free
// tier (250 searches/month) demands more aggressive caching. Flight
// prices are not so volatile that a 6-hour staleness window harms
// users significantly, and a longer TTL materially improves hit
// rate under the 200-search cap enforced by serpApiQuota.
const CACHE_TTL = 21600; // 6 hours

export interface FlightSearchInput {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers: number;
  max_price?: number;
  cabin_class?: string;
  one_way?: boolean;
}

export interface FlightResult {
  offer_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  airline: string;
  airline_logo: string | null;
  flight_number: string;
  price: number;
  currency: string;
  cabin_class: string | null;
  segments: Array<{
    departure: { iataCode: string; at: string };
    arrival: { iataCode: string; at: string };
    carrierCode: string;
    number: string;
  }>;
}

interface SerpApiFlight {
  flights: Array<{
    departure_airport: { id: string; time: string };
    arrival_airport: { id: string; time: string };
    airline: string;
    airline_logo: string;
    flight_number: string;
  }>;
  total_duration: number;
  price: number;
  type: string;
}

interface SerpApiFlightsResponse {
  best_flights?: SerpApiFlight[];
  other_flights?: SerpApiFlight[];
  search_metadata?: { id: string };
  price_insights?: { lowest_price: number };
}

const CABIN_MAP: Record<string, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
};

function normalizeOffer(offer: SerpApiFlight, index: number): FlightResult {
  const firstLeg = offer.flights[0];
  const lastLeg = offer.flights[offer.flights.length - 1];

  return {
    offer_id: `serpapi-flight-${index}`,
    origin: firstLeg?.departure_airport.id ?? '',
    destination: lastLeg?.arrival_airport.id ?? '',
    departure_time: firstLeg?.departure_airport.time ?? '',
    arrival_time: lastLeg?.arrival_airport.time ?? '',
    airline: firstLeg?.airline ?? '',
    airline_logo: firstLeg?.airline_logo ?? null,
    flight_number: firstLeg?.flight_number ?? '',
    price: offer.price,
    currency: 'USD',
    cabin_class: null,
    segments: offer.flights.map((f) => ({
      departure: {
        iataCode: f.departure_airport.id,
        at: f.departure_airport.time,
      },
      arrival: { iataCode: f.arrival_airport.id, at: f.arrival_airport.time },
      carrierCode: f.airline,
      number: f.flight_number,
    })),
  };
}

export async function searchFlights(
  input: FlightSearchInput,
): Promise<FlightResult[]> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockFlights(input);
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-flights', {
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: input.passengers,
    maxPrice: input.max_price,
    cabinClass: input.cabin_class,
    oneWay: input.one_way,
  });

  const cached = await cacheGet<FlightResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Flight search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    departure_id: input.origin,
    arrival_id: input.destination,
    outbound_date: input.departure_date,
    return_date: input.one_way ? undefined : input.return_date,
    adults: input.passengers,
    travel_class: input.cabin_class ? CABIN_MAP[input.cabin_class] : undefined,
    currency: 'USD',
    hl: 'en',
    type: input.one_way ? '2' : undefined,
  };

  let response: SerpApiFlightsResponse;
  try {
    response = (await serpApiGet(
      'google_flights',
      params,
    )) as SerpApiFlightsResponse;
  } catch (err) {
    if (err instanceof SerpApiQuotaExceededError) {
      logger.warn(
        { origin: input.origin, destination: input.destination },
        'Flight search unavailable: SerpApi monthly cap reached',
      );
      // Graceful degrade: return empty results with a hint that the
      // agent can include in its user-facing response.
      return [];
    }
    // Mirror B2's fail-soft pattern: any other SerpApi failure (5xx,
    // region not supported, network) should not propagate to the
    // agent loop. Log at warn and return empty so the agent narrates
    // "no flights found" instead of "having trouble accessing."
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      {
        err,
        origin: input.origin,
        destination: input.destination,
        errorMessage,
      },
      'Flight search failed; returning empty result',
    );
    return [];
  }

  const allFlights = [
    ...(response.best_flights ?? []),
    ...(response.other_flights ?? []),
  ];

  let results = allFlights.map((f, i) => normalizeOffer(f, i));

  if (input.max_price) {
    results = results.filter((r) => r.price <= input.max_price!);
  }

  results = results.sort((a, b) => a.price - b.price).slice(0, 5);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    {
      count: results.length,
      origin: input.origin,
      destination: input.destination,
    },
    'Flight search complete',
  );

  return results;
}
