import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ioredis before importing the module under test.
const mockRedisInstance = {
  get: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
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

let tokenBudget: typeof import('app/services/tokenBudget.service.js');

describe('tokenBudget.service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
    tokenBudget = await import('app/services/tokenBudget.service.js');
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  describe('getDailyTokenUsage', () => {
    it('returns 0 when no counter exists for the user today', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const usage = await tokenBudget.getDailyTokenUsage('user-1');
      expect(usage).toBe(0);
    });

    it('returns the parsed integer value from Redis', async () => {
      mockRedisInstance.get.mockResolvedValue('12345');
      const usage = await tokenBudget.getDailyTokenUsage('user-1');
      expect(usage).toBe(12345);
    });

    it('returns 0 when Redis is unavailable (graceful degrade)', async () => {
      vi.resetModules();
      delete process.env.REDIS_URL;
      const mod = await import('app/services/tokenBudget.service.js');
      const usage = await mod.getDailyTokenUsage('user-1');
      expect(usage).toBe(0);
    });

    it('uses a key scoped to user and current UTC date', async () => {
      mockRedisInstance.get.mockResolvedValue('100');
      await tokenBudget.getDailyTokenUsage('user-42');
      const callArg = mockRedisInstance.get.mock.calls[0]?.[0] as string;
      expect(callArg).toContain('token-budget');
      expect(callArg).toContain('user-42');
      // Today's date in YYYY-MM-DD format should be embedded.
      const today = new Date().toISOString().slice(0, 10);
      expect(callArg).toContain(today);
    });
  });

  describe('addTokenUsage', () => {
    it('increments the Redis counter by the given amount', async () => {
      mockRedisInstance.incrby.mockResolvedValue(5000);
      mockRedisInstance.expire.mockResolvedValue(1);
      await tokenBudget.addTokenUsage('user-1', 5000);
      expect(mockRedisInstance.incrby).toHaveBeenCalledWith(
        expect.stringContaining('user-1'),
        5000,
      );
    });

    it('sets a TTL so the counter resets daily', async () => {
      mockRedisInstance.incrby.mockResolvedValue(100);
      mockRedisInstance.expire.mockResolvedValue(1);
      await tokenBudget.addTokenUsage('user-1', 100);
      expect(mockRedisInstance.expire).toHaveBeenCalled();
    });

    it('is a no-op if tokens is zero or negative', async () => {
      await tokenBudget.addTokenUsage('user-1', 0);
      await tokenBudget.addTokenUsage('user-1', -5);
      expect(mockRedisInstance.incrby).not.toHaveBeenCalled();
    });

    it('does not throw when Redis is unavailable', async () => {
      vi.resetModules();
      delete process.env.REDIS_URL;
      const mod = await import('app/services/tokenBudget.service.js');
      await expect(mod.addTokenUsage('user-1', 1000)).resolves.toBeUndefined();
    });
  });

  describe('isOverDailyBudget', () => {
    it('returns false when usage is under the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('10000');
      const over = await tokenBudget.isOverDailyBudget('user-1', 50000);
      expect(over).toBe(false);
    });

    it('returns true when usage equals the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('50000');
      const over = await tokenBudget.isOverDailyBudget('user-1', 50000);
      expect(over).toBe(true);
    });

    it('returns true when usage exceeds the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('60000');
      const over = await tokenBudget.isOverDailyBudget('user-1', 50000);
      expect(over).toBe(true);
    });

    it('uses DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET when no explicit budget is passed', async () => {
      mockRedisInstance.get.mockResolvedValue('40000');
      const over = await tokenBudget.isOverDailyBudget('user-1');
      // Default is 50000; 40000 is under.
      expect(over).toBe(false);
    });

    it('fails open (returns false) when Redis is unavailable', async () => {
      vi.resetModules();
      delete process.env.REDIS_URL;
      const mod = await import('app/services/tokenBudget.service.js');
      const over = await mod.isOverDailyBudget('user-1', 50000);
      expect(over).toBe(false);
    });
  });
});
