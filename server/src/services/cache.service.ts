import { logger } from 'app/utils/logs/logger.js';
import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      return null;
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error');
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (!client) {
    logger.warn('REDIS_URL is not set — cache disabled');
    return;
  }
  await client.connect();
  logger.info('Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, 'Cache get failed — treating as miss');
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'Cache set failed — data not cached');
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ err, key }, 'Cache del failed');
  }
}

export function normalizeCacheKey(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        const val = params[key];
        acc[key] = typeof val === 'string' ? val.toLowerCase().trim() : val;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  const hash = JSON.stringify(sortedParams);
  return `api_cache:${provider}:${endpoint}:${hash}`;
}
