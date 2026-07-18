import { Request, Response, NextFunction } from 'express';
import requestIp from 'request-ip';
import { logFraud } from '../services/fraudService';
import prisma from '../config/db';
import jwt from 'jsonwebtoken';
import { getRequiredSecret } from '../config/secrets';
import crypto from 'crypto';
import { redisConnection } from '../services/queueService';
import logger from '../utils/logger';

const hashIp = (ip: string) => crypto.createHash('sha256').update(ip).digest('hex');

const REDIS_TIMEOUT_MS = 750;

/**
 * Races a Redis call against a timeout so this middleware — which runs on
 * EVERY request, before any route — can never hang the whole API if Redis
 * is slow or unreachable. `ioredis` is configured with an unbounded offline
 * queue (required for BullMQ), so an unguarded `await redisConnection.x()`
 * during an outage would hang indefinitely rather than reject, which
 * combined with `app.use(fraudDetectionMiddleware)` would mean a Redis blip
 * takes the entire API down. On timeout/error this returns `fallback`
 * instead of throwing — fraud tracking degrades, but real traffic isn't
 * blocked because of an infrastructure hiccup elsewhere.
 */
const withRedisTimeout = async <T>(op: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await Promise.race([
      op,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), REDIS_TIMEOUT_MS)),
    ]);
  } catch (error: any) {
    logger.warn('Fraud middleware: Redis call failed/timed out, failing open', { error: error?.message });
    return fallback;
  }
};

export const fraudDetectionMiddleware = async (req: any, res: Response, next: NextFunction) => {
  try {
    const clientIp = requestIp.getClientIp(req) || 'unknown';
    const ipHash = hashIp(clientIp);
    let userId = req.user?.id;
    if (!userId) {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, getRequiredSecret('JWT_SECRET')) as { id?: number };
          userId = decoded.id;
        } catch {
          // Authentication middleware will return the authoritative 401 on protected routes.
        }
      }
    }

    // Track Multi-Account per IP
    if (userId) {
      const ipUsersKey = `ip_users:${ipHash}`;
      await withRedisTimeout(redisConnection.sadd(ipUsersKey, String(userId)), 0);
      await withRedisTimeout(redisConnection.expire(ipUsersKey, 3600), 0);
      const usersOnIp = await withRedisTimeout(redisConnection.scard(ipUsersKey), 0);

      if (usersOnIp > 3) {
        const userIds = await withRedisTimeout(redisConnection.smembers(ipUsersKey), [] as string[]);
        await logFraud(userId, 'MULTI_ACCOUNT_IP', 'HIGH', { clientIp, userIds }).catch(() => undefined);

        // Auto increase risk score
        await prisma.user.update({
          where: { id: userId },
          data: { riskScore: { increment: 50 } },
        }).catch((error) => logger.warn('Failed to increment riskScore', { error: error?.message }));
      }

      // Shadow Ban Check
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { riskScore: true, shadowBanned: true } });
        if (user && user.riskScore > 80 && !user.shadowBanned) {
          await prisma.user.update({
            where: { id: userId },
            data: { shadowBanned: true },
          });
          // They are now shadow banned.
        }
      } catch (error: any) {
        logger.warn('Fraud middleware: shadow-ban check failed', { error: error?.message });
      }
    }

    const identityKey = userId ? `user:${userId}` : `ip:${ipHash}`;
    const rateKey = `ratelimit:${identityKey}`;

    // Basic Rate Limiting / Auto-tapper detection. Fallback of 1 on Redis
    // failure means "treat as first request this window" — fails open
    // rather than either blocking everyone or silently disabling the check.
    const count = await withRedisTimeout(redisConnection.incr(rateKey), 1);
    if (count === 1) {
      await withRedisTimeout(redisConnection.expire(rateKey, 60), 0);
    }

    if (count > 150) {
      if (userId) {
        await logFraud(userId, 'HIGH_REQUEST_RATE', 'MEDIUM', { count, clientIp }).catch(() => undefined);
      }
      res.status(429).json({ error: 'Suspicious activity detected. Please slow down.' });
      return;
    }

    // VPN Check heuristic: check specific headers often used by proxies
    if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].toString().includes(',')) {
      if (userId) {
        await logFraud(userId, 'PROXY_OR_VPN_DETECTED', 'LOW', { headers: req.headers['x-forwarded-for'] }).catch(() => undefined);
      }
    }

    next();
  } catch (error: any) {
    // Last-resort safety net: this middleware must never be the reason a
    // legitimate request fails. Log and let the request through — fraud
    // signals are best-effort, availability is not negotiable.
    logger.error('fraudDetectionMiddleware failed unexpectedly, failing open', { error: error?.message, stack: error?.stack });
    next();
  }
};
