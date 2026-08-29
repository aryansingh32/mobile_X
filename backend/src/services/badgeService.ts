import prisma from '../config/db';
import { sendToUser } from './notificationService';

// Awards every Badges row of the given conditionType whose conditionValue is
// already met by currentValue and that this user doesn't already hold. Used
// at every place a tracked metric (level, streak, shorts watched, referrals,
// withdrawals) changes, so a badge fires the moment it's actually earned
// instead of needing a separate polling job.
export const checkAndAwardBadges = async (
  userId: number,
  conditionType: string,
  currentValue: number
): Promise<void> => {
  try {
    const eligible = await prisma.badges.findMany({
      where: { conditionType, conditionValue: { lte: currentValue } },
    });
    if (eligible.length === 0) return;

    const owned = await prisma.userBadges.findMany({
      where: { userId, badgeId: { in: eligible.map((b) => b.id) } },
      select: { badgeId: true },
    });
    const ownedIds = new Set(owned.map((o) => o.badgeId));
    const newlyEarned = eligible.filter((b) => !ownedIds.has(b.id));

    for (const badge of newlyEarned) {
      await prisma.userBadges.create({ data: { userId, badgeId: badge.id } });
      sendToUser(userId, `🏅 New Badge: ${badge.name}`, badge.description, 'REWARD').catch(() => undefined);
    }
  } catch {
    // Badge awarding is a bonus, never allowed to break the reward/streak/level
    // flow that triggered it.
  }
};
