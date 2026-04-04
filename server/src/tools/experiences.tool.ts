import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache.service.js';
import { generateMockExperiences } from 'app/tools/mock/experiences.mock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';
import { logger } from 'app/utils/logs/logger.js';

const CACHE_TTL = 3600;
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.photos,places.location';

export interface ExperienceSearchInput {
  location: string;
  categories: string[];
  max_price_per_person?: number;
  limit?: number;
}

export interface ExperienceResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  price_level: string | null;
  estimated_cost: number | null;
  category: string | null;
  photo_ref: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  photos?: Array<{ name: string }>;
  location?: { latitude: number; longitude: number };
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 15,
  PRICE_LEVEL_MODERATE: 35,
  PRICE_LEVEL_EXPENSIVE: 75,
  PRICE_LEVEL_VERY_EXPENSIVE: 150,
};

function normalizePlace(place: GooglePlace): ExperienceResult {
  return {
    place_id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    rating: place.rating ?? null,
    price_level: place.priceLevel ?? null,
    estimated_cost: place.priceLevel
      ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null)
      : null,
    category: place.primaryTypeDisplayName?.text ?? null,
    photo_ref: place.photos?.[0]?.name ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
  };
}

export async function searchExperiences(
  input: ExperienceSearchInput,
): Promise<ExperienceResult[]> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockExperiences(input);
  }

  const cacheKey = normalizeCacheKey('google_places', 'text-search', {
    location: input.location,
    categories: input.categories.join(','),
    limit: input.limit,
  });

  const cached = await cacheGet<ExperienceResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Experience search cache hit');
    return cached;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const categoryText =
    input.categories.length > 0 ? input.categories.join(' ') + ' ' : '';
  const textQuery = `${categoryText}in ${input.location}`;

  const response = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: input.limit || 5,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { places: GooglePlace[] };
  const results = (data.places || []).map(normalizePlace);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    { count: results.length, location: input.location },
    'Experience search complete',
  );

  return results;
}
