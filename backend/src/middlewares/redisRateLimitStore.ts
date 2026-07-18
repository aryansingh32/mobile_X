import { Store } from 'express-rate-limit';
import { redisConnection } from '../services/queueService';
import logger from '../utils/logger';

/**
 * express-rate-limit defaults to an in-memory Store, which only tracks
 * requests seen by the single process it's running in. The moment this app
 * runs as more than one instance (any real horizontally-scaled production
 * deployment), each instance enforces the limit independently — so a
 * "20 requests/hour" login limiter actually allows `20 * instanceCount`,
 * and the same is true for the withdrawal-abuse limiter. This store backs
 * the same counters used elsewhere in this codebase (Redis, already a
 * dependency) so the limit is enforced correctly no matter how many
 * instances are running.
 *
 * Fails open on Redis errors — same reasoning as fraudMiddleware.ts: a rate
 * limiter must never be the reason legitimate traffic goes down because of
 * an unrelated infrastructure hiccup.
 */
export class RedisRateLimitStore implements Store {
  windowMs = 60_000;
  prefix: string;

  constructor(prefix: string) {
    this.prefix = `ratelimit:${prefix}:`;
  }

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  private key(key: string) {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      const redisKey = this.key(key);
      const totalHits = await redisConnection.incr(redisKey);
      if (totalHits === 1) {
        await redisConnection.pexpire(redisKey, this.windowMs);
      }
      const ttl = await redisConnection.pttl(redisKey);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
      return { totalHits, resetTime };
    } catch (error: any) {
      logger.warn('RedisRateLimitStore: increment failed, failing open', { error: error?.message });
      // Returning a low count means "don't block" — availability wins over
      // strict enforcement during a Redis outage.
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await redisConnection.decr(this.key(key));
    } catch (error: any) {
      logger.warn('RedisRateLimitStore: decrement failed', { error: error?.message });
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await redisConnection.del(this.key(key));
    } catch (error: any) {
      logger.warn('RedisRateLimitStore: resetKey failed', { error: error?.message });
    }
  }
}

export default RedisRateLimitStore;
