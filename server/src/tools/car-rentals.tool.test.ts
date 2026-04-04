import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/serpapi.service.js');
vi.mock('app/services/cache.service.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchCarRentals: typeof import('app/tools/car-rentals.tool.js').searchCarRentals;
let serpApiService: typeof import('app/services/serpapi.service.js');
let cacheService: typeof import('app/services/cache.service.js');

const mockCarRentalResponse = {
  cars_results: [
    {
      vehicle_info: { name: 'Toyota Corolla or similar', class: 'Compact' },
      price: { per_day: 45, total: 315, currency: 'USD' },
      rental_company: { name: 'Hertz', logo: 'https://logo.com/hertz.png' },
      pickup_location: 'NRT Airport',
      dropoff_location: 'NRT Airport',
      features: ['Automatic', 'Air Conditioning', '5 Seats'],
      vehicle_image: 'https://img.com/corolla.jpg',
    },
    {
      vehicle_info: { name: 'Honda Fit or similar', class: 'Economy' },
      price: { per_day: 35, total: 245, currency: 'USD' },
      rental_company: { name: 'Budget', logo: 'https://logo.com/budget.png' },
      pickup_location: 'NRT Airport',
      dropoff_location: 'NRT Airport',
      features: ['Manual', 'Air Conditioning', '4 Seats'],
      vehicle_image: 'https://img.com/honda-fit.jpg',
    },
  ],
};

describe('car-rentals.tool', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('app/services/serpapi.service.js', () => ({
      serpApiGet: vi.fn(),
    }));
    vi.doMock('app/services/cache.service.js', () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue('test-car-rental-cache-key'),
    }));
    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('app/tools/mock/isMockMode.js', () => ({
      isMockMode: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('app/tools/mock/car-rentals.mock.js', () => ({
      generateMockCarRentals: vi.fn(),
    }));

    const carRentalMod = await import('app/tools/car-rentals.tool.js');
    searchCarRentals = carRentalMod.searchCarRentals;
    serpApiService = await import('app/services/serpapi.service.js');
    cacheService = await import('app/services/cache.service.js');
  });

  describe('searchCarRentals', () => {
    it('returns cached results when available', async () => {
      const cached = {
        rentals: [{ provider: 'Hertz', car_name: 'Toyota Corolla' }],
      };
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result).toEqual(cached);
      expect(serpApiService.serpApiGet).not.toHaveBeenCalled();
    });

    it('calls SerpApi and returns normalized results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockCarRentalResponse,
      );

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals).toHaveLength(2);
      expect(result.rentals[0]).toHaveProperty('provider');
      expect(result.rentals[0]).toHaveProperty('car_name');
      expect(result.rentals[0]).toHaveProperty('total_price');
      expect(result.rentals[0]).toHaveProperty('price_per_day');
      expect(result.rentals[0]!.provider).toBe('Hertz');
      expect(result.rentals[0]!.car_name).toBe('Toyota Corolla or similar');
      expect(result.rentals[0]!.total_price).toBe(315);
    });

    it('normalizes car_type to lowercase', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockCarRentalResponse,
      );

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals[0]!.car_type).toBe('compact');
    });

    it('caches results after fetching', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockCarRentalResponse,
      );

      await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        'test-car-rental-cache-key',
        expect.objectContaining({ rentals: expect.any(Array) }),
        3600,
      );
    });

    it('returns empty rentals array when API returns no results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        cars_results: [],
      });

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals).toEqual([]);
    });

    it('handles missing cars_results gracefully', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({});

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals).toEqual([]);
    });

    it('uses pickup_location as dropoff_location when dropoff_location is not provided', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        cars_results: [
          {
            vehicle_info: { name: 'Toyota Corolla', class: 'Compact' },
            price: { per_day: 45, total: 315, currency: 'USD' },
            rental_company: { name: 'Hertz' },
            features: [],
          },
        ],
      });

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals[0]!.dropoff_location).toBe('Tokyo');
    });

    it('limits results to 5 cars', async () => {
      const manyCars = Array.from({ length: 10 }, (_, i) => ({
        vehicle_info: { name: `Car ${i}`, class: 'Economy' },
        price: { per_day: 30 + i, total: 210 + i * 7, currency: 'USD' },
        rental_company: { name: `Provider ${i}` },
        features: [],
      }));

      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        cars_results: manyCars,
      });

      const result = await searchCarRentals({
        pickup_location: 'Tokyo',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      });

      expect(result.rentals).toHaveLength(5);
    });
  });
});
