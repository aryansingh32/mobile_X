import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../services/queueService';
import logger from '../utils/logger';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

/**
 * In-memory fallback only — used when Redis is unreachable, so caching
 * degrades gracefully instead of taking the request down. This is NOT the
 * primary cache: a naive per-instance Map is wrong once there's more than
 * one API instance (each instance would serve stale/different cached data,
 * and `invalidateCache` would only clear the instance it ran on). The
 * primary cache is Redis, which is shared across all instances and already
 * a dependency (see queueService.ts).
 */
const fallbackCache = new Map<string, CacheEntry>();
const FALLBACK_MAX_ENTRIES = 500;
const REDIS_CACHE_TIMEOUT_MS = 500;
const CACHE_KEY_PREFIX = 'http_cache:';

const withTimeout = async <T>(op: Promise<T>): Promise<T> => {
  return Promise.race([
    op,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis_cache_timeout')), REDIS_CACHE_TIMEOUT_MS)),
  ]);
};

const setFallback = (key: string, data: any, ttlSeconds: number) => {
  if (fallbackCache.size >= FALLBACK_MAX_ENTRIES) {
    const oldestKey = fallbackCache.keys().next().value;
    if (oldestKey) fallbackCache.delete(oldestKey);
  }
  fallbackCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
};

export const cacheMiddleware = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const queryForCache = { ...req.query };
    delete queryForCache.excludeIds; // Prevent cache poisoning by stripping high-cardinality keys
    const sortedQuery = Object.keys(queryForCache).sort().reduce((acc, k) => {
      acc[k] = queryForCache[k];
      return acc;
    }, {} as Record<string, any>);

    const key = `${CACHE_KEY_PREFIX}${req.path}:${JSON.stringify(sortedQuery)}`;

    try {
      const cached = await withTimeout(redisConnection.get(key));
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        res.setHeader('Vary', 'x-api-signature, authorization');
        res.json(JSON.parse(cached));
        return;
      }
    } catch (error: any) {
      // Redis unavailable/slow — fall through to the in-memory fallback below.
      const fallback = fallbackCache.get(key);
      if (fallback && fallback.expiresAt > Date.now()) {
        res.setHeader('X-Cache', 'HIT-FALLBACK');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        res.setHeader('Vary', 'x-api-signature, authorization');
        res.json(fallback.data);
        return;
      }
      logger.warn('cacheMiddleware: Redis read failed, proceeding uncached', { error: error?.message });
    }

    // Intercept res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Vary', 'x-api-signature, authorization');
      setFallback(key, data, ttlSeconds);
      redisConnection.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch((error: any) => {
        logger.warn('cacheMiddleware: Redis write failed', { error: error?.message });
      });
      return originalJson(data);
    };

    next();
  };
};

// Cache invalidation helper — call this when admin updates RSS sources or ad config.
// Uses SCAN (not KEYS) so it doesn't block Redis on a large keyspace.
export const invalidateCache = async (pathPrefix: string) => {
  for (const key of fallbackCache.keys()) {
    if (key.includes(pathPrefix)) fallbackCache.delete(key);
  }

  try {
    const matchPattern = `${CACHE_KEY_PREFIX}${pathPrefix}*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await withTimeout(redisConnection.scan(cursor, 'MATCH', matchPattern, 'COUNT', 100));
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisConnection.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error: any) {
    logger.warn('invalidateCache: Redis scan/delete failed', { error: error?.message, pathPrefix });
  }
};
