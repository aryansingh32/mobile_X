import prisma from '../config/db';
import { addLedgerEntry } from './ledgerService';
import { sendToUser } from './notificationService';
import { checkAndAwardBadges } from './badgeService';

// Used only until the first real config read resolves, and as the fallback
// when an admin hasn't touched `level_xp_thresholds` yet or has set it to
// something unparseable. thresholds[i] is the cumulative XP required to BE
// level i+1 — level = 1 + how many thresholds the user's XP has cleared, so
// the level cap is simply however many entries the admin-managed array has,
// not a number baked into this file.
const DEFAULT_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

const parseLevelThresholds = (raw: string | undefined): number[] => {
  if (!raw) return DEFAULT_LEVEL_THRESHOLDS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LEVEL_THRESHOLDS;
    const nums = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return DEFAULT_LEVEL_THRESHOLDS;
    // Admin panel already sorts/validates on save, but never trust stored
    // config blindly — a hand-edited row could still be out of order.
    return [...nums].sort((a, b) => a - b);
  } catch {
    return DEFAULT_LEVEL_THRESHOLDS;
  }
};

// Exported so getProfile (userController.ts) can serve the SAME thresholds
// the backend actually levels users against — the mobile app used to keep
// its own hardcoded copy of this table for the XP bar, which could silently
// drift from whatever this file said the moment either one changed.
export const getLevelThresholds = async (): Promise<number[]> => {
  const config = await prisma.appConfig.findUnique({ where: { key: 'level_xp_thresholds' } });
  return parseLevelThresholds(config?.value);
};

export type StreakMilestone = { day: number; bonusCoins: number; title: string; body: string };

const DEFAULT_STREAK_MILESTONES: StreakMilestone[] = [
  { day: 7, bonusCoins: 100, title: '🔥 7-Day Streak!', body: 'Amazing! You earned {coins} bonus coins!' },
  { day: 30, bonusCoins: 500, title: '🏆 30-Day Streak!', body: 'Incredible! You earned {coins} bonus coins and a special badge!' },
  { day: 100, bonusCoins: 2000, title: '💯 100-Day Streak!', body: 'Unbelievable! You earned {coins} bonus coins!' },
];

const parseStreakMilestones = (raw: string | undefined): StreakMilestone[] => {
  if (!raw) return DEFAULT_STREAK_MILESTONES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_STREAK_MILESTONES;
    const milestones = parsed
      .map((m: any): StreakMilestone | null => {
        const day = Number(m?.day);
        const bonusCoins = Number(m?.bonusCoins);
        if (!Number.isFinite(day) || day <= 0 || !Number.isFinite(bonusCoins) || bonusCoins < 0) return null;
        return {
          day,
          bonusCoins,
          title: typeof m?.title === 'string' && m.title.trim() ? m.title : `🎉 ${day}-Day Streak!`,
          body: typeof m?.body === 'string' && m.body.trim() ? m.body : 'You earned {coins} bonus coins!',
        };
      })
      .filter((m: StreakMilestone | null): m is StreakMilestone => m !== null);
    return milestones.length > 0 ? milestones : DEFAULT_STREAK_MILESTONES;
  } catch {
    return DEFAULT_STREAK_MILESTONES;
  }
};

export const getStreakMilestones = async (): Promise<StreakMilestone[]> => {
  const config = await prisma.appConfig.findUnique({ where: { key: 'streak_milestones' } });
  return parseStreakMilestones(config?.value);
};

const computeLevelForXp = (xp: number, thresholds: number[]): number => {
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]!) level = i + 1;
    else break;
  }
  return level;
};

export const addExp = async (userId: number, xpToAdd: number) => {
  if (!Number.isFinite(xpToAdd) || xpToAdd === 0) {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
    if (!current) throw new Error('User not found');
    return { newXp: current.xp, newLevel: current.level, leveledUp: false };
  }

  // Atomic DB-level increment — avoids a lost-update race when addExp is
  // called concurrently for the same user (e.g. two reward claims landing
  // at once would otherwise both read the same starting xp and the second
  // write would silently overwrite the first).
  const [updatedUser, thresholds] = await Promise.all([
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: xpToAdd } } }),
    getLevelThresholds(),
  ]);

  const previousLevel = updatedUser.level;
  // Never let a level go DOWN. Levels are normally always in sync with XP
  // since this is the only place level is ever written — but an admin
  // editing `level_xp_thresholds` (Progression page) after users have
  // already reached a level under the old table is a real, expected
  // scenario, and their next XP gain must not silently demote them just
  // because their stored XP no longer clears the new, larger requirement.
  const newLevel = Math.max(previousLevel, computeLevelForXp(updatedUser.xp, thresholds));

  if (newLevel !== previousLevel) {
    await prisma.user.update({ where: { id: userId }, data: { level: newLevel } });
    checkAndAwardBadges(userId, 'LEVEL', newLevel).catch(() => undefined);
  }

  return { newXp: updatedUser.xp, newLevel, leveledUp: newLevel > previousLevel };
};

export const updateStreak = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const now = new Date();
  const lastLogin = new Date(user.lastLogin);

  const todayStr = now.toISOString().split('T')[0];
  const lastLoginStr = lastLogin.toISOString().split('T')[0];

  // Already claimed today
  if (todayStr === lastLoginStr) {
    return { newStreak: user.streak, broken: false, freezeUsed: false };
  }

  const todayDate = new Date(todayStr as string);
  const lastLoginDate = new Date(lastLoginStr as string);
  const diffTime = todayDate.getTime() - lastLoginDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let newStreak = user.streak;
  let freezeUsed = false;
  let streakFreezesRemaining = user.streakFreezes;

  if (diffDays === 1) {
    newStreak++; // consecutive day
  } else if (diffDays > 1) {
    // Loss-aversion save: a held streak-freeze token absorbs the missed
    // day(s) automatically instead of resetting the streak. This is the
    // whole point of `User.streakFreezes` existing — previously nothing in
    // the codebase ever read it, so the column just sat there unused.
    if (user.streakFreezes > 0) {
      newStreak++;
      freezeUsed = true;
      streakFreezesRemaining = user.streakFreezes - 1;
      sendToUser(
        userId,
        '🛡️ Streak Freeze Used!',
        `Your ${newStreak - 1}-day streak was about to break — a freeze saved it automatically.`,
        'STREAK'
      ).catch(() => {});
    } else {
      newStreak = 1; // broken streak
      // Don't await sendToUser here to prevent blocking, let it fail silently
      sendToUser(userId, 'Streak Broken! 😢', 'Your streak broke! Come back and restart.', 'STREAK').catch(() => {});
    }
  } else {
    // Should never happen unless clock goes backwards
    return { newStreak: user.streak, broken: false, freezeUsed: false };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { streak: newStreak, lastLogin: now, streakFreezes: streakFreezesRemaining },
  });

  checkAndAwardBadges(userId, 'STREAK', newStreak).catch(() => undefined);

  // Streak milestone rewards — the day numbers, bonus amounts, and even the
  // notification copy all come from one admin-editable list (`streak_milestones`
  // AppConfig JSON) instead of three separate hardcoded `if (newStreak === N)`
  // blocks. That previously meant the highest reachable milestone was day 30,
  // hard-baked into this file — an admin can now add day 14, day 60, day 365,
  // whatever the retention strategy calls for, with no deploy.
  const milestone = (await getStreakMilestones()).find((m) => m.day === newStreak);
  if (milestone) {
    try {
      await addLedgerEntry(userId, milestone.bonusCoins, `STREAK_BONUS_${milestone.day}`, 'system', `streak-${milestone.day}-${userId}-${todayStr}`);
      sendToUser(userId, milestone.title, milestone.body.replace('{coins}', String(milestone.bonusCoins)), 'STREAK').catch(() => {});
    } catch (e: any) {
      if (e.code !== 'P2002') throw e; // ignore duplicate claim
    }
  }

  return { newStreak, broken: diffDays > 1 && !freezeUsed, freezeUsed };
};
