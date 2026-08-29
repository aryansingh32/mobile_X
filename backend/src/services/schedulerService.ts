import cron from 'node-cron';
import prisma from '../config/db';
import { sendToUser } from './notificationService';
import { escalateReferralTiers } from './referralService';
import logger from '../utils/logger';

// Daily missions' UserMissions.completedAt was never cleared by anything —
// once a user finished today's list, the screen stayed permanently empty
// despite the UI promising "new missions arrive at midnight." Reset both
// completedAt and progress for every DAILY-type mission row so the loop
// actually repeats.
const resetDailyMissions = async (): Promise<void> => {
  const result = await prisma.userMissions.updateMany({
    where: { mission: { type: 'DAILY' } },
    data: { progress: 0, completedAt: null },
  });
  logger.info(`[scheduler] Daily mission reset: ${result.count} row(s) reset`);
};

// Proactive loss-aversion nudge — fires for users whose streak is about to
// expire (they haven't opened the app yet today) instead of the old
// break-it-then-tell-them notification. Skipped for users already protected
// by a streak freeze since there's nothing urgent to warn them about.
const sendStreakBreakWarnings = async (): Promise<void> => {
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const atRisk = await prisma.user.findMany({
    where: { streak: { gt: 0 }, banned: false },
    select: { id: true, lastLogin: true, streak: true, streakFreezes: true },
  });

  let warned = 0;
  for (const user of atRisk) {
    const lastLoginStr = new Date(user.lastLogin).toISOString().split('T')[0];
    if (lastLoginStr !== yesterdayStr) continue; // already claimed today, or streak isn't actually at risk tonight
    if (user.streakFreezes > 0) continue; // protected — no urgent warning needed

    sendToUser(
      user.id,
      `🔥 Your ${user.streak}-day streak breaks at midnight!`,
      'Open the app in the next few hours to keep it alive — or buy a streak freeze in Wallet.',
      'STREAK'
    ).catch(() => undefined);
    warned++;
  }
  logger.info(`[scheduler] Streak-break warnings sent: ${warned}`);
};

// Automated inactivity win-back — the admin panel already has cohort-based
// manual push tools (INACTIVE_3_DAYS / INACTIVE_7_DAYS), but nothing fired
// them without an admin clicking send. Dedupes against the Notification log
// so the same user isn't pinged every single day they stay inactive.
const sendInactivityWinback = async (): Promise<void> => {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const threeDaysAgo = new Date(now - 3 * DAY_MS);
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const dedupeCutoff = new Date(now - 3 * DAY_MS);

  const candidates = await prisma.user.findMany({
    where: { banned: false, lastActiveAt: { lt: threeDaysAgo } },
    select: { id: true, lastActiveAt: true },
    take: 5000,
  });

  let sent = 0;
  for (const user of candidates) {
    const recentWinback = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'WINBACK', sentAt: { gte: dedupeCutoff } },
      select: { id: true },
    });
    if (recentWinback) continue;

    const isWeekPlus = user.lastActiveAt < sevenDaysAgo;
    const title = isWeekPlus ? 'We miss you! 🎬' : 'Your coins are waiting 🪙';
    const body = isWeekPlus
      ? "It's been a week — come back and pick up your streak and daily missions."
      : "You've got unclaimed daily missions and a streak on the line. Jump back in!";
    sendToUser(user.id, title, body, 'WINBACK').catch(() => undefined);
    sent++;
  }
  logger.info(`[scheduler] Inactivity win-back pushes sent: ${sent}`);
};

export const startScheduledJobs = (): void => {
  // 00:05 server time — after midnight so "today" has fully rolled over.
  cron.schedule('5 0 * * *', async () => {
    try {
      await resetDailyMissions();
      await escalateReferralTiers();
    } catch (err) {
      logger.error('[scheduler] Midnight maintenance job failed', err as any);
    }
  });

  // 20:00 server time — evening warning window before the day actually ends.
  cron.schedule('0 20 * * *', async () => {
    try {
      await sendStreakBreakWarnings();
    } catch (err) {
      logger.error('[scheduler] Streak-break warning job failed', err as any);
    }
  });

  // 11:00 server time — clear of both other jobs, once-daily win-back sweep.
  cron.schedule('0 11 * * *', async () => {
    try {
      await sendInactivityWinback();
    } catch (err) {
      logger.error('[scheduler] Inactivity win-back job failed', err as any);
    }
  });
};
