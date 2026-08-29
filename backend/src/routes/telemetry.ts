import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import prisma from '../config/db';
import logger from '../utils/logger';
import { checkAndAwardBadges } from '../services/badgeService';
import { clientErrorLimiter } from '../middlewares/securityMiddleware';

const router = Router();

const VALID_PLATFORMS = new Set(['ios', 'android', 'web']);

// Telemetry counts drive lifetime totals, mission progress and badge awards,
// all of which are increments. A negative or absurd count from a tampered
// client could rewind a counter or complete a mission in one call, so clamp
// before anything downstream sees it.
const MAX_EVENT_COUNT = 1000;
const sanitizeCount = (raw: unknown): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.floor(parsed), 0), MAX_EVENT_COUNT);
};

// ── POST /client-error — crash/error reports from a real user's device ───────
// Without this, a crash on a user's phone is invisible: the app renders the
// ErrorBoundary's generic screen and the stack dies with the process. These
// land in the same ErrorLog table as server errors (source='CLIENT'), so the
// admin panel shows one timeline per user across both sides.
//
// Everything here is untrusted input from a client that is already
// malfunctioning, so every field is length-capped and type-checked, and a
// malformed report is dropped rather than 500ing back at a crashing app.
router.post('/client-error', authenticate, clientErrorLimiter, async (req: any, res) => {
  const { message, stack, platform, appVersion, fatal, screen } = req.body ?? {};

  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    await prisma.errorLog.create({
      data: {
        userId: req.user.id,
        source: 'CLIENT',
        method: 'CLIENT',
        // `screen` is where in the app it blew up — the closest client-side
        // analogue to a request path, and what makes the admin log readable.
        path: typeof screen === 'string' ? screen.slice(0, 500) : 'unknown',
        statusCode: 0, // not an HTTP failure; keeps 4xx/5xx filters meaningful
        message: message.slice(0, 2000),
        stack: typeof stack === 'string' ? stack.slice(0, 8000) : null,
        platform: typeof platform === 'string' && VALID_PLATFORMS.has(platform) ? platform : null,
        appVersion: typeof appVersion === 'string' ? appVersion.slice(0, 40) : null,
        fatal: fatal === true,
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    // Never surface a logging failure to a client that is already crashing.
    logger.error('Failed to persist client error report', { error: err?.message });
    res.json({ success: true });
  }
});

// ── Internal helper ───────────────────────────────────────────────────────────
// Processes a single telemetry event. Used by both /track and /batch.
async function processTelemetryEvent(userId: number, eventType: string, count: number) {
  // 1. Update user lifetime metrics
  const userUpdate: any = {};
  if (eventType === 'SCREENTIME_MIN') userUpdate.lifetimeScreentimeMin = { increment: count };
  else if (eventType === 'NEWS_READ') userUpdate.lifetimeNewsReads = { increment: count };
  else if (eventType === 'ADS_WATCHED_DISCOVER' || eventType === 'ADS_WATCHED_SHORTS' || eventType === 'AD_WATCHED') userUpdate.lifetimeAdsWatched = { increment: count };
  else if (eventType === 'SHORTS_WATCHED') userUpdate.lifetimeShortsWatched = { increment: count };
  else if (eventType === 'GAMES_PLAYED') userUpdate.lifetimeGamesPlayed = { increment: count };
  else if (eventType === 'OFFERWALL') userUpdate.lifetimeOfferwallTasks = { increment: count };
  // lifetimeReferrals not in Prisma schema — skip

  if (Object.keys(userUpdate).length > 0) {
    const updatedUser = await prisma.user.update({ where: { id: userId }, data: userUpdate });
    if (eventType === 'SHORTS_WATCHED') {
      checkAndAwardBadges(userId, 'SHORTS_WATCHED', updatedUser.lifetimeShortsWatched).catch(() => undefined);
    }
  }

  // 2. Find and update active missions with this metricType
  const activeMissions = await prisma.missions.findMany({
    where: { isActive: true, metricType: eventType },
  });

  for (const mission of activeMissions) {
    let userMission = await prisma.userMissions.findFirst({ where: { userId, missionId: mission.id } });

    if (!userMission) {
      userMission = await prisma.userMissions.create({
        data: { userId, missionId: mission.id, progress: count }
      });
    } else if (!userMission.completedAt) {
      userMission = await prisma.userMissions.update({
        where: { id: userMission.id },
        data: { progress: { increment: count } },
      });
    }

    // Check if mission just completed
    if (userMission && !userMission.completedAt && userMission.progress >= mission.targetCount) {
      await prisma.$transaction(async (tx) => {
        await tx.userMissions.update({ where: { id: userMission!.id }, data: { completedAt: new Date() } });
        await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: mission.rewardXp }, totalCoinsEarned: { increment: mission.rewardCoins } }
        });
        if (mission.rewardCoins > 0) {
          await tx.coinLedger.create({
            data: {
              userId,
              amount: mission.rewardCoins,
              source: `MISSION_COMPLETED_${mission.id}`,
              idempotencyKey: `mission_reward_${userId}_${mission.id}_${Date.now()}`,
              sessionId: 'MISSION_REWARD',
              ipHash: 'SYSTEM',
            }
          });
        }
      });
    }
  }
}

// ── POST /track — single event (backward compatible) ─────────────────────────
router.post('/track', authenticate, async (req: any, res) => {
  const { eventType } = req.body;
  const count = sanitizeCount(req.body?.count ?? 1);
  const userId = req.user.id;

  if (!eventType) return res.status(400).json({ error: 'eventType is required' });

  try {
    await processTelemetryEvent(userId, eventType, count);
    res.json({ success: true });
  } catch (err) {
    logger.error('Telemetry /track error', { eventType, err });
    res.status(500).json({ error: 'Failed to process telemetry' });
  }
});

// ── POST /batch — multiple events in one HTTP round-trip ─────────────────────
// Replaces the client's per-event sequential loop. Each event is processed
// independently so a single failure doesn't abort the rest.
router.post('/batch', authenticate, async (req: any, res) => {
  const { events } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events must be a non-empty array' });
  }

  const results: { eventType: string; success: boolean; error?: string }[] = [];

  for (const event of events) {
    const { eventType } = event ?? {};
    const count = sanitizeCount(event?.count ?? 1);
    if (!eventType) {
      results.push({ eventType: 'unknown', success: false, error: 'missing eventType' });
      continue;
    }
    try {
      await processTelemetryEvent(userId, eventType, count);
      results.push({ eventType, success: true });
    } catch (err) {
      logger.error('Batch telemetry event error', { eventType, err });
      results.push({ eventType, success: false, error: 'processing failed' });
    }
  }

  res.json({ success: true, results });
});

export default router;
