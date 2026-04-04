import { logger } from 'app/utils/logs/logger.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { metrics } from './metrics.service.js';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockLogger = vi.mocked(logger);

describe('MetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackApiCall logs structured metric with provider and latency', () => {
    metrics.trackApiCall('serpapi', 'google-flights', 250, true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'api_call',
        provider: 'serpapi',
        endpoint: 'google-flights',
        latencyMs: 250,
        cacheHit: true,
      }),
      expect.any(String),
    );
  });

  it('trackApiCall includes error when provided', () => {
    metrics.trackApiCall('google_places', 'text-search', 500, false, 'timeout');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'api_call',
        error: 'timeout',
      }),
      expect.any(String),
    );
  });

  it('trackAgentLoop logs iteration count and token usage', () => {
    metrics.trackAgentLoop('trip-1', 3, 1500, 800, 4500, 5);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'agent_loop',
        tripId: 'trip-1',
        iterations: 3,
        tokensInput: 1500,
        tokensOutput: 800,
        durationMs: 4500,
        toolCalls: 5,
      }),
      expect.any(String),
    );
  });

  it('trackError logs source and error message', () => {
    metrics.trackError('serpapi', 'Connection refused', { engine: 'flights' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'error',
        source: 'serpapi',
        error: 'Connection refused',
        engine: 'flights',
      }),
      expect.any(String),
    );
  });

  it('trackRateLimit logs user and endpoint', () => {
    metrics.trackRateLimit('user-123', '/trips/:id/chat');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'rate_limit',
        userId: 'user-123',
        endpoint: '/trips/:id/chat',
      }),
      expect.any(String),
    );
  });

  it('trackCacheOperation logs hit/miss for get operations', () => {
    metrics.trackCacheOperation('get', 'flight-key', true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'cache_op',
        operation: 'get',
        key: 'flight-key',
        hit: true,
      }),
      expect.any(String),
    );
  });
});
