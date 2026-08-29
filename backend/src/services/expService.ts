import prisma from '../config/db';
import { addLedgerEntry } from './ledgerService';
import { sendToUser } from './notificationService';
import { checkAndAwardBadges } from './badgeService';

export const LEVEL_REQUIREMENTS: Record<number, number> = {
  1: 0, 2: 100, 3: 300, 4: 600, 5: 1000,
  6: 1500, 7: 2100, 8: 2800, 9: 3600, 10: 4500,
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
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: xpToAdd } },
  });

  const previousLevel = updatedUser.level;
  let newLevel = previousLevel;
  let nextLevelReq = LEVEL_REQUIREMENTS[newLevel + 1];
  while (nextLevelReq !== undefined && updatedUser.xp >= nextLevelReq) {
    newLevel++;
    nextLevelReq = LEVEL_REQUIREMENTS[newLevel + 1];
  }

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

  // Streak milestone rewards with concurrency locks (idempotency keys)
  if (newStreak === 7) {
    const bonus7Config = await prisma.appConfig.findUnique({ where: { key: 'streak_bonus_7' } });
    const bonus = bonus7Config ? parseInt(bonus7Config.value) : 100;
    try {
      await addLedgerEntry(userId, bonus, 'STREAK_BONUS_7', 'system', `streak-7-${userId}-${todayStr}`);
      sendToUser(userId, '🔥 7-Day Streak!', `Amazing! You earned ${bonus} bonus coins!`, 'STREAK').catch(() => {});
    } catch (e: any) {
      if (e.code !== 'P2002') throw e; // ignore duplicate claim
    }
  }

  if (newStreak === 30) {
    const bonus30Config = await prisma.appConfig.findUnique({ where: { key: 'streak_bonus_30' } });
    const bonus = bonus30Config ? parseInt(bonus30Config.value) : 500;
    try {
      await addLedgerEntry(userId, bonus, 'STREAK_BONUS_30', 'system', `streak-30-${userId}-${todayStr}`);
      sendToUser(userId, '🏆 30-Day Streak!', `Incredible! You earned ${bonus} bonus coins and a special badge!`, 'STREAK').catch(() => {});
    } catch (e: any) {
      if (e.code !== 'P2002') throw e; // ignore duplicate claim
    }
  }

  // Previously the highest streak milestone in the app was day 30 — anyone
  // who kept going past that got nothing further to aim for.
  if (newStreak === 100) {
    const bonus100Config = await prisma.appConfig.findUnique({ where: { key: 'streak_bonus_100' } });
    const bonus = bonus100Config ? parseInt(bonus100Config.value) : 2000;
    try {
      await addLedgerEntry(userId, bonus, 'STREAK_BONUS_100', 'system', `streak-100-${userId}-${todayStr}`);
      sendToUser(userId, '💯 100-Day Streak!', `Unbelievable! You earned ${bonus} bonus coins!`, 'STREAK').catch(() => {});
    } catch (e: any) {
      if (e.code !== 'P2002') throw e; // ignore duplicate claim
    }
  }

  return { newStreak, broken: diffDays > 1 && !freezeUsed, freezeUsed };
};
