import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/serpapi.service.js');
vi.mock('app/services/cache.service.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let searchHotels: typeof import('app/tools/hotels.tool.js').searchHotels;
let serpApiService: typeof import('app/services/serpapi.service.js');
let cacheService: typeof import('app/services/cache.service.js');

const mockHotelsResponse = {
  properties: [
    {
      name: 'Hotel Barcelona Beach',
      overall_rating: 4.5,
      hotel_class: 4,
      rate_per_night: { lowest: '$150', extracted_lowest: 150 },
      total_rate: { lowest: '$750', extracted_lowest: 750 },
    },
    {
      name: 'Budget Inn Barcelona',
      overall_rating: 3.2,
      hotel_class: 2,
      rate_per_night: { lowest: '$80', extracted_lowest: 80 },
      total_rate: { lowest: '$400', extracted_lowest: 400 },
    },
  ],
};

describe('hotels.tool', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('app/services/serpapi.service.js', () => ({
      serpApiGet: vi.fn(),
    }));
    vi.doMock('app/services/cache.service.js', () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue('test-hotel-cache-key'),
    }));
    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('app/tools/mock/isMockMode.js', () => ({
      isMockMode: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('app/tools/mock/hotels.mock.js', () => ({
      generateMockHotels: vi.fn(),
    }));

    const hotelsMod = await import('app/tools/hotels.tool.js');
    searchHotels = hotelsMod.searchHotels;
    serpApiService = await import('app/services/serpapi.service.js');
    cacheService = await import('app/services/cache.service.js');
  });

  describe('searchHotels', () => {
    it('returns cached results when available', async () => {
      const cached = [{ name: 'Hotel Barcelona', price_per_night: 150 }];
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result).toEqual(cached);
      expect(serpApiService.serpApiGet).not.toHaveBeenCalled();
    });

    it('calls SerpApi and returns normalized results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('total_price');
      expect(result[0]).toHaveProperty('star_rating');
      expect(result[0]).toHaveProperty('hotel_id');
    });

    it('sorts results by total price ascending', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result[0]!.total_price).toBeLessThanOrEqual(
        result[1]!.total_price,
      );
    });

    it('caches results after fetching', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        'test-hotel-cache-key',
        expect.any(Array),
        3600,
      );
    });

    it('handles empty results gracefully', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [],
      });

      const result = await searchHotels({
        city: 'XYZ',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 1,
      });

      expect(result).toEqual([]);
    });

    it('filters by star_rating_min', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
        star_rating_min: 3,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Hotel Barcelona Beach');
    });

    it('filters by max_price_per_night', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce(
        mockHotelsResponse,
      );

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
        max_price_per_night: 100,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Budget Inn Barcelona');
    });

    it("parses hotel_class string format (e.g. '4-star hotel')", async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      vi.mocked(serpApiService.serpApiGet).mockResolvedValueOnce({
        properties: [
          {
            name: 'Fancy Hotel',
            overall_rating: 4.5,
            hotel_class: '4-star hotel',
            rate_per_night: { lowest: '$200', extracted_lowest: 200 },
            total_rate: { lowest: '$1000', extracted_lowest: 1000 },
          },
        ],
      });

      const result = await searchHotels({
        city: 'Barcelona',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(result[0]!.star_rating).toBe(4);
    });
  });
});
