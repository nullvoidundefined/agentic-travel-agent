import { logger } from 'app/utils/logs/logger.js';
import { Redis } from 'ioredis';

/**
 * Per-user daily output-token budget for the agent loop.
 *
 * Counters are stored in Redis with a 25-hour TTL (24 hours plus a
 * one-hour safety margin for timezone skew). Keys are scoped by
 * user ID and the current UTC date so they reset at UTC midnight.
 *
 * This exists to provide a second line of defense beyond the
 * Anthropic console's monthly spending cap: even if the monthly cap
 * is generous, a single compromised or runaway session should not be
 * able to exhaust the entire budget on one user's behalf. The limit
 * is conservative by default and can be tuned up if real usage shows
 * legitimate users hitting it.
 */

export const DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET = 50_000;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) {
    return redis;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error in tokenBudget');
    });
    return redis;
  } catch (err) {
    logger.error({ err }, 'Failed to create Redis client for tokenBudget');
    return null;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function keyFor(userId: string): string {
  return `token-budget:${userId}:${todayUtc()}`;
}

/**
 * Returns the user's cumulative output-token usage for the current
 * UTC day, or 0 if Redis is unavailable or the counter does not exist.
 */
export async function getDailyTokenUsage(userId: string): Promise<number> {
  const client = getRedis();
  if (!client) {
    return 0;
  }
  try {
    const raw = await client.get(keyFor(userId));
    if (raw === null) {
      return 0;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    logger.error(
      { err, userId },
      'Failed to read token budget counter, failing open',
    );
    return 0;
  }
}

/**
 * Adds `tokens` to the user's daily counter. No-op if tokens <= 0 or
 * if Redis is unavailable. Sets a 25-hour TTL on first write so the
 * counter auto-expires.
 */
export async function addTokenUsage(
  userId: string,
  tokens: number,
): Promise<void> {
  if (tokens <= 0) {
    return;
  }
  const client = getRedis();
  if (!client) {
    return;
  }
  try {
    const key = keyFor(userId);
    await client.incrby(key, tokens);
    // 25 hours: 24h for the day plus 1h safety margin for timezone skew.
    await client.expire(key, 25 * 60 * 60);
  } catch (err) {
    logger.error(
      { err, userId, tokens },
      'Failed to increment token budget counter',
    );
  }
}

/**
 * Returns true if the user has met or exceeded their daily budget.
 * Fails open (returns false) if Redis is unavailable, because a
 * Redis outage should not block legitimate agent calls.
 */
export async function isOverDailyBudget(
  userId: string,
  budget: number = DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET,
): Promise<boolean> {
  const usage = await getDailyTokenUsage(userId);
  return usage >= budget;
}
