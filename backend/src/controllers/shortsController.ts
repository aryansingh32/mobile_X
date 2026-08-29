import crypto from 'crypto';
import { Request, Response } from 'express';
import { fetchTrendingShorts as fetchApiTrendingShorts } from '../services/youtubeService';
import prisma from '../config/db';
import { eventQueue, redisConnection } from '../services/queueService';
import requestIp from 'request-ip';
import { sendServerError } from '../utils/errorResponse';
import logger from '../utils/logger';
import { parseLimit } from '../utils/pagination';

export const getShorts = async (req: Request, res: Response) => {
  try {
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : 0;
    const limit = parseLimit(req.query.limit, 10, 50);
    // Parse excluded video IDs sent from client (seen content this session)
    const excludeIds = req.query.excludeIds
      ? (req.query.excludeIds as string).split(',').filter(Boolean)
      : [];

    // Priority: admin-uploaded pool first
    const poolVideos = await prisma.youtubeVideoPool.findMany({
      where: { 
        active: true,
        ...(excludeIds.length > 0 ? { videoId: { notIn: excludeIds } } : {}),
        OR: [
          { categoryId: null },
          { category: { active: true } }
        ]
      },
      orderBy: { addedAt: 'desc' },
      skip: cursor,
      take: limit,
    });

    let data: any[] = poolVideos.map(v => ({
      videoId: v.videoId,
      title: v.title || 'YouTube Short',
      coinsOnComplete: 0,
    }));

    // Fallback to YouTube API if pool is insufficient
    if (data.length < limit) {
      const apiShorts = await fetchApiTrendingShorts();
      const needed = limit - data.length;
      const poolIds = new Set([...data.map(d => d.videoId), ...excludeIds]);
      const extras = apiShorts
        .filter((s: any) => !poolIds.has(s.videoId))
        .slice(0, needed)
        .map((s: any) => ({ ...s, coinsOnComplete: 0 }));
      data = [...data, ...extras];
    }

    // Fisher-Yates shuffle — each session sees videos in a different order
    for (let i = data.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [data[i], data[j]] = [data[j], data[i]];
    }

    const nextCursor = cursor + data.length;
    res.json({ data, nextCursor: data.length < limit ? null : nextCursor });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getTrendingShorts = async (req: Request, res: Response) => {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: 'TRENDING_SHORTS_MODE' } });
    const mode = config?.value || 'RANDOM'; // TOP10, RANDOM, MANUAL

    const trendingVideos = await prisma.youtubeVideoPool.findMany({
      where: { active: true },
      orderBy: mode === 'TOP10' ? { addedAt: 'desc' } : {},
    });

    let data = trendingVideos.map(v => ({
      videoId: v.videoId,
      title: v.title || 'YouTube Short',
      coinsOnComplete: 0,
    }));

    if (mode === 'RANDOM' && data.length > 0) {
      // Fisher-Yates shuffle
      for (let i = data.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        const temp = data[i];
        data[i] = data[j]!;
        data[j] = temp!;
      }
    }

    res.json({ data: data.slice(0, 10) });
  } catch (error: any) {
    sendServerError(res, error);
  }
};


// A YouTube Short is capped well under this in practice — anything claimed
// above it cannot be a genuine single watch-time report and is clamped
// rather than trusted outright.
const MAX_PLAUSIBLE_WATCH_SECONDS = 180;
// Minimum gap between accepted reports for the *same* video by the *same*
// user — without this, nothing stops a client from calling this endpoint
// in a tight loop with a large watchSeconds value to mint unlimited XP,
// since watchSeconds was otherwise taken entirely on faith.
const PER_VIDEO_COOLDOWN_SECONDS = 30;

export const reportWatchTime = async (req: any, res: Response): Promise<void> => {
  try {
    const { videoId, watchSeconds: rawWatchSeconds } = req.body;
    if (!videoId || typeof videoId !== 'string' || rawWatchSeconds == null) {
      res.status(400).json({ error: 'videoId and watchSeconds are required' });
      return;
    }

    const watchSecondsNumber = Number(rawWatchSeconds);
    if (!Number.isFinite(watchSecondsNumber) || watchSecondsNumber < 0) {
      res.status(400).json({ error: 'watchSeconds must be a non-negative number' });
      return;
    }
    // Never trust the raw client value for reward math — clamp to a
    // plausible ceiling regardless of what was reported.
    const watchSeconds = Math.min(watchSecondsNumber, MAX_PLAUSIBLE_WATCH_SECONDS);

    const userId = req.user.id;

    const cooldownKey = `shorts_watch_cooldown:${userId}:${videoId}`;
    try {
      const setResult = await redisConnection.set(cooldownKey, '1', 'EX', PER_VIDEO_COOLDOWN_SECONDS, 'NX');
      if (setResult === null) {
        // Already reported for this video within the cooldown window —
        // acknowledge the request (so the client doesn't treat it as an
        // error and retry-storm) but award nothing further.
        res.json({ message: 'Watch time already recorded recently', coinsEarned: 0, xpEarned: 0 });
        return;
      }
    } catch (error: any) {
      // Redis unavailable — fail open on the cooldown (don't block a
      // legitimate report), but this is exactly the kind of gap that
      // matters, so log it clearly.
      logger.warn('reportWatchTime: cooldown check failed, failing closed', { error: error?.message });
      res.status(503).json({ error: 'Service Unavailable (Rate Limiter Down)' });
      return;
    }

    const REWARD_COINS_PER_10_SEC = 0;
    const REWARD_XP_PER_10_SEC = 2;

    const coinsEarned = Math.floor(watchSeconds / 10) * REWARD_COINS_PER_10_SEC;
    const xpEarned = Math.floor(watchSeconds / 10) * REWARD_XP_PER_10_SEC;
    const clientIp = requestIp.getClientIp(req) || 'unknown';

    // Offload to BullMQ for asynchronous processing
    await eventQueue.add('WATCH_COMPLETED', {
      userId, videoId, watchSeconds, coinsEarned, xpEarned, clientIp
    });

    res.json({ message: 'Watch time reported, processing in background', coinsEarned, xpEarned });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
