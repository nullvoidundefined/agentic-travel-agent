import { logger } from 'app/utils/logs/logger.js';

export interface MetricsService {
  trackApiCall(
    provider: string,
    endpoint: string,
    latencyMs: number,
    cacheHit: boolean,
    error?: string,
  ): void;

  trackAgentLoop(
    tripId: string,
    iterations: number,
    tokensInput: number,
    tokensOutput: number,
    durationMs: number,
    toolCalls: number,
  ): void;

  trackError(
    source: string,
    error: string,
    metadata?: Record<string, unknown>,
  ): void;

  trackRateLimit(userId: string, endpoint: string): void;

  trackCacheOperation(
    operation: 'get' | 'set' | 'del',
    key: string,
    hit?: boolean,
  ): void;
}

/** Structured-log implementation. Swap to DataDog/Prometheus by replacing this class. */
class LogMetricsService implements MetricsService {
  trackApiCall(
    provider: string,
    endpoint: string,
    latencyMs: number,
    cacheHit: boolean,
    error?: string,
  ): void {
    logger.info(
      {
        metric: 'api_call',
        provider,
        endpoint,
        latencyMs,
        cacheHit,
        ...(error && { error }),
      },
      'API call metric',
    );
  }

  trackAgentLoop(
    tripId: string,
    iterations: number,
    tokensInput: number,
    tokensOutput: number,
    durationMs: number,
    toolCalls: number,
  ): void {
    logger.info(
      {
        metric: 'agent_loop',
        tripId,
        iterations,
        tokensInput,
        tokensOutput,
        durationMs,
        toolCalls,
      },
      'Agent loop metric',
    );
  }

  trackError(
    source: string,
    error: string,
    metadata?: Record<string, unknown>,
  ): void {
    logger.error(
      { metric: 'error', source, error, ...metadata },
      'Error metric',
    );
  }

  trackRateLimit(userId: string, endpoint: string): void {
    logger.warn(
      { metric: 'rate_limit', userId, endpoint },
      'Rate limit metric',
    );
  }

  trackCacheOperation(
    operation: 'get' | 'set' | 'del',
    key: string,
    hit?: boolean,
  ): void {
    logger.info(
      { metric: 'cache_op', operation, key, ...(hit !== undefined && { hit }) },
      'Cache operation metric',
    );
  }
}

/** Singleton metrics instance. Import and use throughout the app. */
export const metrics: MetricsService = new LogMetricsService();
