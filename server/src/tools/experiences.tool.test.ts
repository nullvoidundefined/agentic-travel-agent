import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/cache.service.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

let searchExperiences: typeof import('app/tools/experiences.tool.js').searchExperiences;
let cacheService: typeof import('app/services/cache.service.js');

const mockPlacesResponse = {
  places: [
    {
      id: 'place_1',
      displayName: { text: 'Sagrada Familia Tour' },
      formattedAddress: 'Carrer de Mallorca, Barcelona',
      rating: 4.7,
      priceLevel: 'PRICE_LEVEL_MODERATE',
      primaryTypeDisplayName: { text: 'Tourist Attraction' },
    },
    {
      id: 'place_2',
      displayName: { text: 'Barcelona Cooking Class' },
      formattedAddress: 'La Rambla 45, Barcelona',
      rating: 4.9,
      priceLevel: 'PRICE_LEVEL_MODERATE',
      primaryTypeDisplayName: { text: 'Cooking Class' },
    },
  ],
};

describe('experiences.tool', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('app/services/cache.service.js', () => ({
      cacheGet: vi.fn(),
      cacheSet: vi.fn(),
      normalizeCacheKey: vi.fn().mockReturnValue('test-exp-cache-key'),
    }));
    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('app/tools/mock/isMockMode.js', () => ({
      isMockMode: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('app/tools/mock/experiences.mock.js', () => ({
      generateMockExperiences: vi.fn(),
    }));

    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';

    const expMod = await import('app/tools/experiences.tool.js');
    searchExperiences = expMod.searchExperiences;
    cacheService = await import('app/services/cache.service.js');
  });

  describe('searchExperiences', () => {
    it('returns cached results when available', async () => {
      const cached = [{ name: 'Sagrada Familia', rating: 4.7 }];
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(cached);

      const result = await searchExperiences({
        location: 'Barcelona',
        categories: ['tours'],
      });

      expect(result).toEqual(cached);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls Google Places API and returns normalized results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesResponse,
      });

      const result = await searchExperiences({
        location: 'Barcelona',
        categories: ['tours'],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'Sagrada Familia Tour');
      expect(result[0]).toHaveProperty('address');
      expect(result[0]).toHaveProperty('rating', 4.7);
      expect(result[0]).toHaveProperty('place_id', 'place_1');
      expect(result[0]).toHaveProperty('photo_ref', null);
      expect(result[0]).toHaveProperty('latitude', null);
      expect(result[0]).toHaveProperty('longitude', null);
    });

    it('normalizes photo_ref and coordinates when present', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'place_3',
              displayName: { text: 'Park Güell' },
              formattedAddress: "Carrer d'Olot, Barcelona",
              rating: 4.6,
              priceLevel: 'PRICE_LEVEL_MODERATE',
              primaryTypeDisplayName: { text: 'Park' },
              photos: [{ name: 'places/place_3/photos/photo_abc123' }],
              location: { latitude: 41.4145, longitude: 2.1527 },
            },
          ],
        }),
      });

      const result = await searchExperiences({
        location: 'Barcelona',
        categories: ['parks'],
      });

      expect(result[0]).toHaveProperty(
        'photo_ref',
        'places/place_3/photos/photo_abc123',
      );
      expect(result[0]).toHaveProperty('latitude', 41.4145);
      expect(result[0]).toHaveProperty('longitude', 2.1527);
    });

    it('sends correct headers including API key and field mask', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      await searchExperiences({
        location: 'Barcelona',
        categories: ['museum'],
      });

      const fetchCall = mockFetch.mock.calls[0]!;
      expect(fetchCall[1].headers['X-Goog-Api-Key']).toBe('test-api-key');
      expect(fetchCall[1].headers['X-Goog-FieldMask']).toBeDefined();
    });

    it('constructs text query from location and categories', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      await searchExperiences({
        location: 'Paris',
        categories: ['museum', 'art gallery'],
      });

      const fetchCall = mockFetch.mock.calls[0]!;
      const body = JSON.parse(fetchCall[1].body);
      expect(body.textQuery).toContain('Paris');
      expect(body.textQuery).toContain('museum');
    });

    it('caches results after fetching', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesResponse,
      });

      await searchExperiences({
        location: 'Barcelona',
        categories: ['tours'],
      });

      expect(cacheService.cacheSet).toHaveBeenCalledWith(
        'test-exp-cache-key',
        expect.any(Array),
        3600,
      );
    });

    it('handles empty results', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      const result = await searchExperiences({
        location: 'Middle of Nowhere',
        categories: [],
      });

      expect(result).toEqual([]);
    });

    it('handles API errors', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      await expect(
        searchExperiences({
          location: 'Barcelona',
          categories: ['tours'],
        }),
      ).rejects.toThrow();
    });

    it('respects max_results limit', async () => {
      vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesResponse,
      });

      await searchExperiences({
        location: 'Barcelona',
        categories: ['tours'],
        limit: 10,
      });

      const fetchCall = mockFetch.mock.calls[0]!;
      const body = JSON.parse(fetchCall[1].body);
      expect(body.maxResultCount).toBe(10);
    });
  });
});
