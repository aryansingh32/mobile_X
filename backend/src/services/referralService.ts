import prisma from '../config/db';
import { sendToUser } from './notificationService';

// Referral.tier is read everywhere a referral bonus is paid out (withdrawal
// commission, SSV-adjacent flows) but nothing ever moved a referral past
// tier 1 — this is the missing promotion step. Run daily: a referred user
// who has stuck around and stayed active earns their referrer a better
// commission rate on every future withdrawal they make.
export const escalateReferralTiers = async (): Promise<void> => {
  const referrals = await prisma.referral.findMany({
    where: { tier: { lt: 3 } },
    include: { referred: { select: { createdAt: true, lastActiveAt: true } } },
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const referral of referrals) {
    const daysSinceReferred = (now - referral.referred.createdAt.getTime()) / DAY_MS;
    const recentlyActive = (now - referral.referred.lastActiveAt.getTime()) < 7 * DAY_MS;

    let newTier = referral.tier;
    if (referral.tier === 1 && daysSinceReferred >= 30 && recentlyActive) newTier = 2;
    else if (referral.tier === 2 && daysSinceReferred >= 90 && recentlyActive) newTier = 3;

    if (newTier !== referral.tier) {
      await prisma.referral.update({ where: { id: referral.id }, data: { tier: newTier } });
      sendToUser(
        referral.referrerId,
        '🎉 Referral Tier Up!',
        `One of your referrals has been active for a while — your commission rate on their earnings just went up to Tier ${newTier}.`,
        'REFERRAL'
      ).catch(() => undefined);
    }
  }
};
