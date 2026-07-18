import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import prisma from '../config/db';
import logger from '../utils/logger';

const router = Router();

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
    await prisma.user.update({ where: { id: userId }, data: userUpdate });
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
  const { eventType, count = 1 } = req.body;
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
    const { eventType, count = 1 } = event;
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
