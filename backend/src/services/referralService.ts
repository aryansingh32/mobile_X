import prisma from '../config/db';
import { sendToUser } from './notificationService';

const getConfigInt = async (key: string, fallback: number): Promise<number> => {
  const config = await prisma.appConfig.findUnique({ where: { key } });
  const parsed = config ? Number.parseInt(config.value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Referral.tier is read everywhere a referral bonus is paid out (withdrawal
// commission, SSV-adjacent flows) but nothing ever moved a referral past
// tier 1 — this is the missing promotion step. Run daily: a referred user
// who has stuck around and stayed active earns their referrer a better
// commission rate on every future withdrawal they make. Every threshold
// below (and the tier % rates themselves — see referral_percent_tier_1/2/3,
// read in walletController.ts) is admin-configurable via AppConfig, editable
// from the admin panel's Referrals page.
export const escalateReferralTiers = async (): Promise<void> => {
  const [tier2Days, tier3Days, activeWindowDays] = await Promise.all([
    getConfigInt('referral_tier2_days', 30),
    getConfigInt('referral_tier3_days', 90),
    getConfigInt('referral_active_window_days', 7),
  ]);

  const referrals = await prisma.referral.findMany({
    where: { tier: { lt: 3 } },
    include: { referred: { select: { createdAt: true, lastActiveAt: true } } },
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const referral of referrals) {
    const daysSinceReferred = (now - referral.referred.createdAt.getTime()) / DAY_MS;
    const recentlyActive = (now - referral.referred.lastActiveAt.getTime()) < activeWindowDays * DAY_MS;

    let newTier = referral.tier;
    if (referral.tier === 1 && daysSinceReferred >= tier2Days && recentlyActive) newTier = 2;
    else if (referral.tier === 2 && daysSinceReferred >= tier3Days && recentlyActive) newTier = 3;

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
