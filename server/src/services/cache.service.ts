import Redis from "ioredis";

import { logger } from "app/utils/logs/logger.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set");
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  await client.connect();
  logger.info("Redis connected");
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  const raw = await client.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  await client.del(key);
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
        acc[key] = typeof val === "string" ? val.toLowerCase().trim() : val;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  const hash = JSON.stringify(sortedParams);
  return `api_cache:${provider}:${endpoint}:${hash}`;
}
