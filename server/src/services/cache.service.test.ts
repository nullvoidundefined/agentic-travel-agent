import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ioredis before importing the module under test
const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedisInstance),
  Redis: vi.fn(() => mockRedisInstance),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Dynamic import to pick up mocks
let cacheService: typeof import('app/services/cache.service.js');

describe('cache.service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to reset module state
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock('ioredis', () => ({
      default: vi.fn(() => mockRedisInstance),
      Redis: vi.fn(() => mockRedisInstance),
    }));
    vi.doMock('app/utils/logs/logger.js', () => ({
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    cacheService = await import('app/services/cache.service.js');
  });

  afterEach(async () => {
    // Clean up redis connection state
    try {
      await cacheService.disconnectRedis();
    } catch {
      // ignore
    }
  });

  describe('getRedis', () => {
    it('returns null when REDIS_URL is not set', () => {
      delete process.env.REDIS_URL;
      expect(cacheService.getRedis()).toBeNull();
    });

    it('creates a Redis client when REDIS_URL is set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const client = cacheService.getRedis();
      expect(client).not.toBeNull();
      expect(client!.on).toBeDefined();
    });

    it('returns the same instance on subsequent calls', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const client1 = cacheService.getRedis();
      const client2 = cacheService.getRedis();
      expect(client1).toBe(client2);
    });
  });

  describe('cacheGet', () => {
    it('returns null when key does not exist', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockResolvedValueOnce(null);

      const result = await cacheService.cacheGet('missing-key');
      expect(result).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('missing-key');
    });

    it('returns parsed JSON when key exists', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const data = { flights: [{ price: 450 }] };
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify(data));

      const result = await cacheService.cacheGet('flight-key');
      expect(result).toEqual(data);
    });
  });

  describe('cacheSet', () => {
    it('stores JSON-serialized value with TTL', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const data = { price: 450 };

      await cacheService.cacheSet('my-key', data, 3600);

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'my-key',
        JSON.stringify(data),
        'EX',
        3600,
      );
    });
  });

  describe('cacheDel', () => {
    it('deletes the key from Redis', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await cacheService.cacheDel('old-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('old-key');
    });
  });

  describe('normalizeCacheKey', () => {
    it('generates a deterministic key from sorted params', () => {
      const key1 = cacheService.normalizeCacheKey('amadeus', 'flight-offers', {
        origin: 'SFO',
        destination: 'BCN',
        date: '2026-07-01',
      });
      const key2 = cacheService.normalizeCacheKey('amadeus', 'flight-offers', {
        destination: 'BCN',
        date: '2026-07-01',
        origin: 'SFO',
      });
      expect(key1).toBe(key2);
    });

    it('normalizes string values to lowercase and trimmed', () => {
      const key1 = cacheService.normalizeCacheKey('amadeus', 'flight-offers', {
        origin: '  SFO  ',
      });
      const key2 = cacheService.normalizeCacheKey('amadeus', 'flight-offers', {
        origin: 'sfo',
      });
      expect(key1).toBe(key2);
    });

    it('includes provider and endpoint in key', () => {
      const key = cacheService.normalizeCacheKey(
        'google_places',
        'text-search',
        {
          query: 'museum',
        },
      );
      expect(key).toContain('api_cache:google_places:text-search:');
    });

    it('preserves non-string values as-is', () => {
      const key = cacheService.normalizeCacheKey('amadeus', 'flight-offers', {
        adults: 2,
        max: 5,
      });
      expect(key).toContain('"adults":2');
      expect(key).toContain('"max":5');
    });
  });

  describe('graceful degradation', () => {
    it('cacheGet returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const result = await cacheService.cacheGet('any-key');
      expect(result).toBeNull();
    });

    it('cacheSet is a no-op when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      await expect(
        cacheService.cacheSet('key', { data: 1 }, 3600),
      ).resolves.toBeUndefined();
    });

    it('cacheGet returns null when Redis throws', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await cacheService.cacheGet('failing-key');
      expect(result).toBeNull();
    });

    it('cacheSet does not throw when Redis throws', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.set.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        cacheService.cacheSet('failing-key', { data: 1 }, 3600),
      ).resolves.toBeUndefined();
    });

    it('cacheDel does not throw when Redis throws', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.del.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        cacheService.cacheDel('failing-key'),
      ).resolves.toBeUndefined();
    });
  });

  describe('connectRedis', () => {
    it('calls connect on the Redis client', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisInstance.connect.mockResolvedValueOnce(undefined);

      await cacheService.connectRedis();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });
  });

  describe('disconnectRedis', () => {
    it('calls quit and resets the instance', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      cacheService.getRedis(); // initialize
      mockRedisInstance.quit.mockResolvedValueOnce(undefined);

      await cacheService.disconnectRedis();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
