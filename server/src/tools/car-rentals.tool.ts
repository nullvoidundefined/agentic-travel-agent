import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache.service.js';
import { serpApiGet } from 'app/services/serpapi.service.js';
import { generateMockCarRentals } from 'app/tools/mock/car-rentals.mock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';
import { logger } from 'app/utils/logs/logger.js';

const CACHE_TTL = 3600; // 1 hour

export interface CarRentalInput {
  pickup_location: string;
  pickup_date: string;
  dropoff_date: string;
  dropoff_location?: string;
  car_type?: string;
}

export interface CarRentalResult {
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[];
  image_url?: string;
}

interface SerpApiCarResult {
  vehicle_info?: { name?: string; class?: string };
  price?: { per_day?: number; total?: number; currency?: string };
  rental_company?: { name?: string; logo?: string };
  pickup_location?: string;
  dropoff_location?: string;
  features?: string[];
  vehicle_image?: string;
}

interface SerpApiCarRentalResponse {
  cars_results?: SerpApiCarResult[];
}

function normalizeCarRental(
  car: SerpApiCarResult,
  input: CarRentalInput,
): CarRentalResult {
  return {
    provider: car.rental_company?.name ?? 'Unknown',
    provider_logo: car.rental_company?.logo,
    car_name: car.vehicle_info?.name ?? 'Unknown Vehicle',
    car_type: (car.vehicle_info?.class ?? 'standard').toLowerCase(),
    price_per_day: car.price?.per_day ?? 0,
    total_price: car.price?.total ?? 0,
    currency: car.price?.currency ?? 'USD',
    pickup_location: car.pickup_location ?? input.pickup_location,
    dropoff_location:
      car.dropoff_location ?? input.dropoff_location ?? input.pickup_location,
    pickup_date: input.pickup_date,
    dropoff_date: input.dropoff_date,
    features: car.features ?? [],
    image_url: car.vehicle_image,
  };
}

export async function searchCarRentals(
  input: CarRentalInput,
): Promise<{ rentals: CarRentalResult[] }> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockCarRentals(input);
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-car-rental', {
    pickupLocation: input.pickup_location,
    pickupDate: input.pickup_date,
    dropoffDate: input.dropoff_date,
    dropoffLocation: input.dropoff_location,
    carType: input.car_type,
  });

  const cached = await cacheGet<{ rentals: CarRentalResult[] }>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Car rental search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    pickup_location: input.pickup_location,
    pickup_date: input.pickup_date,
    dropoff_date: input.dropoff_date,
    dropoff_location: input.dropoff_location,
    hl: 'en',
    currency: 'USD',
  };

  const response = (await serpApiGet(
    'google_car_rental',
    params,
  )) as SerpApiCarRentalResponse;

  const carsResults = response.cars_results ?? [];
  const rentals = carsResults
    .slice(0, 5)
    .map((car) => normalizeCarRental(car, input));

  const result = { rentals };
  await cacheSet(cacheKey, result, CACHE_TTL);
  logger.info(
    { count: rentals.length, pickup_location: input.pickup_location },
    'Car rental search complete',
  );

  return result;
}
