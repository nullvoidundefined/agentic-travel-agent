import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache.service.js';
import {
  SerpApiQuotaExceededError,
  serpApiGet,
} from 'app/services/serpapi.service.js';
import { generateMockHotels } from 'app/tools/mock/hotels.mock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';
import { logger } from 'app/utils/logs/logger.js';

// FIN-07: extended from 1h to 6h on 2026-04-06. See flights.tool.ts
// for rationale. Hotel prices are even less volatile than flights.
const CACHE_TTL = 21600; // 6 hours

export interface HotelSearchInput {
  city: string;
  check_in: string;
  check_out: string;
  guests: number;
  star_rating_min?: number;
  max_price_per_night?: number;
}

export interface HotelResult {
  hotel_id: string;
  offer_id: string;
  name: string;
  address: string;
  city: string;
  star_rating: number;
  total_price: number;
  price_per_night: number;
  currency: string;
  check_in: string;
  check_out: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SerpApiHotel {
  name: string;
  overall_rating: number;
  hotel_class: number | string;
  rate_per_night?: { lowest: string; extracted_lowest: number };
  total_rate?: { lowest: string; extracted_lowest: number };
  nearby_places?: Array<{ name: string }>;
  gps_coordinates?: { latitude: number; longitude: number };
  check_in_time?: string;
  check_out_time?: string;
  link?: string;
  images?: Array<{ thumbnail: string; original_image?: string }>;
}

interface SerpApiHotelsResponse {
  properties?: SerpApiHotel[];
  search_metadata?: { id: string };
}

function parseStarRating(hotelClass: number | string | undefined): number {
  if (typeof hotelClass === 'number') return hotelClass;
  if (typeof hotelClass === 'string') {
    const match = hotelClass.match(/(\d)/);
    return match ? Number(match[1]) : 0;
  }
  return 0;
}

function normalizeHotel(
  entry: SerpApiHotel,
  index: number,
  input: HotelSearchInput,
): HotelResult {
  return {
    hotel_id: `serpapi-hotel-${index}`,
    offer_id: `serpapi-hotel-offer-${index}`,
    name: entry.name,
    address: '',
    city: input.city,
    star_rating: parseStarRating(entry.hotel_class),
    total_price:
      entry.total_rate?.extracted_lowest ??
      entry.rate_per_night?.extracted_lowest ??
      0,
    price_per_night: entry.rate_per_night?.extracted_lowest ?? 0,
    currency: 'USD',
    check_in: input.check_in,
    check_out: input.check_out,
    image_url: entry.images?.[0]?.thumbnail ?? null,
    latitude: entry.gps_coordinates?.latitude ?? null,
    longitude: entry.gps_coordinates?.longitude ?? null,
  };
}

export async function searchHotels(
  input: HotelSearchInput,
): Promise<HotelResult[]> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockHotels(input);
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-hotels', {
    city: input.city,
    checkIn: input.check_in,
    checkOut: input.check_out,
    guests: input.guests,
    starRatingMin: input.star_rating_min,
  });

  const cached = await cacheGet<HotelResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Hotel search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    q: `hotels in ${input.city}`,
    check_in_date: input.check_in,
    check_out_date: input.check_out,
    adults: input.guests,
    currency: 'USD',
    hl: 'en',
  };

  let response: SerpApiHotelsResponse;
  try {
    response = (await serpApiGet(
      'google_hotels',
      params,
    )) as SerpApiHotelsResponse;
  } catch (err) {
    if (err instanceof SerpApiQuotaExceededError) {
      logger.warn(
        { city: input.city },
        'Hotel search unavailable: SerpApi monthly cap reached',
      );
      return [];
    }
    // Mirror B2's fail-soft pattern: any other SerpApi failure (5xx,
    // region not supported, network) should not propagate to the
    // agent loop. Log at warn and return empty so the agent narrates
    // "no hotels found" instead of "having trouble accessing."
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err, city: input.city, errorMessage },
      'Hotel search failed; returning empty result',
    );
    return [];
  }

  let results = (response.properties ?? []).map((h, i) =>
    normalizeHotel(h, i, input),
  );

  if (input.star_rating_min) {
    results = results.filter((r) => r.star_rating >= input.star_rating_min!);
  }

  if (input.max_price_per_night) {
    results = results.filter(
      (r) => r.price_per_night <= input.max_price_per_night!,
    );
  }

  results = results.sort((a, b) => a.total_price - b.total_price).slice(0, 5);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    { count: results.length, city: input.city },
    'Hotel search complete',
  );

  return results;
}
