import { Request, Response } from 'express';
import prisma from '../config/db';
import { updateStreak } from '../services/expService';
import { addLedgerEntry, getBalance } from '../services/ledgerService';
import requestIp from 'request-ip';
import { sendServerError } from '../utils/errorResponse';

const getConfigValue = async (key: string, fallback: string): Promise<string> => {
  const config = await prisma.appConfig.findUnique({ where: { key } });
  return config?.value ?? fallback;
};

const getConfigInt = async (key: string, fallback: number): Promise<number> => {
  const parsed = Number.parseInt(await getConfigValue(key, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getConfigFloat = async (key: string, fallback: number): Promise<number> => {
  const parsed = Number.parseFloat(await getConfigValue(key, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isSameDay = (a?: Date | null, b = new Date()): boolean => {
  if (!a) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        userBadges: { include: { badge: true } },
        userMissions: { include: { mission: true } },
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      balance,
      dailyAdsUsed,
      todayCoinsAggregate,
      streakClaim,
      dailyAdCap,
      coinToInrRate,
      minWithdrawalCoins,
      adRewardedCoins,
      adRewardedInterstitialCoins,
      adRewardedDiscoverCoins,
      dailyBonusCoins,
      shortWatchRewardCoins,
      rouletteDailyChances,
      rouletteAdsWatchedToday,
      rouletteSpinsToday,
    ] = await Promise.all([
      getBalance(user.id),
      prisma.coinLedger.count({
        where: {
          userId: user.id,
          source: { in: ['AD_REWARDED', 'AD_REWARDED_INTERSTITIAL', 'AD_REWARDED_DISCOVER'] },
          timestamp: { gte: todayStart },
        },
      }),
      prisma.coinLedger.aggregate({
        where: { userId: user.id, amount: { gt: 0 }, timestamp: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.coinLedger.findFirst({
        where: { userId: user.id, source: 'DAILY_LOGIN', timestamp: { gte: todayStart } },
        select: { id: true },
      }),
      getConfigInt('daily_ad_cap', 20),
      getConfigFloat('coin_to_inr_rate', 0.10),
      getConfigInt('min_withdrawal_coins', 500),
      getConfigInt('ad_rewarded_coins', 100),
      getConfigInt('ad_rewarded_interstitial_coins', 50),
      getConfigInt('ad_rewarded_discover_coins', 50),
      getConfigInt('daily_bonus_coins', 20),
      getConfigInt('short_watch_reward_coins', 0),
      getConfigInt('roulette_daily_chances', 2),
      prisma.coinLedger.count({
        where: {
          userId: user.id,
          source: 'ROULETTE_AD',
          timestamp: { gte: todayStart },
        },
      }),
      prisma.coinLedger.count({
        where: {
          userId: user.id,
          source: 'ROULETTE_SPIN',
          timestamp: { gte: todayStart },
        },
      }),
    ]);

    const rouletteChancesRemaining = Math.max(0, rouletteDailyChances + rouletteAdsWatchedToday - rouletteSpinsToday);

    res.json({
      data: {
        ...user,
        coins: balance,
        dailyAdsUsed,
        dailyAdCap,
        dailyAdRemaining: Math.max(0, dailyAdCap - dailyAdsUsed),
        todayCoinsEarned: todayCoinsAggregate._sum.amount || 0,
        streakClaimedToday: !!streakClaim,
        dailyBonusAvailable: !isSameDay(user.lastDailyBonus),
        coinToInrRate,
        minWithdrawalCoins,
        rouletteChancesRemaining,
        config: {
          daily_ad_cap: dailyAdCap,
          coin_to_inr_rate: coinToInrRate,
          min_withdrawal_coins: minWithdrawalCoins,
          ad_rewarded_coins: adRewardedCoins,
          ad_rewarded_interstitial_coins: adRewardedInterstitialCoins,
          ad_rewarded_discover_coins: adRewardedDiscoverCoins,
          daily_bonus_coins: dailyBonusCoins,
          short_watch_reward_coins: shortWatchRewardCoins,
          roulette_daily_chances: rouletteDailyChances,
        },
      },
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const claimDailyBonus = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastDailyBonus: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (isSameDay(user.lastDailyBonus)) {
      res.json({ claimed: false, message: 'Already claimed today' });
      return;
    }

    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const coinsEarned = await getConfigInt('daily_bonus_coins', 20);
    const clientIp = requestIp.getClientIp(req) || 'unknown';

    try {
      await addLedgerEntry(userId, coinsEarned, 'DAILY_BONUS', clientIp, dateKey);
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.json({ claimed: false, message: 'Already claimed today' });
        return;
      }
      throw error;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastDailyBonus: now,
        totalCoinsEarned: { increment: coinsEarned },
      },
    });

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    res.json({ claimed: true, coinsEarned, nextBonus: tomorrow.toISOString() });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const claimDailyMissions = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const missions = await prisma.missions.findMany({ where: { type: 'DAILY' } });
    const userMissions = await prisma.userMissions.findMany({
      where: { userId },
    });
    
    let allCompleted = true;
    for (const mission of missions) {
      const um = userMissions.find(u => u.missionId === mission.id);
      const target = mission.targetCount || 1;
      const progress = um?.progress || 0;
      if (!um?.completedAt && progress < target) {
        allCompleted = false;
        break;
      }
    }
    
    if (missions.length === 0 || !allCompleted) {
      res.json({ claimed: false, message: 'Not all missions are completed' });
      return;
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastDailyBonus: true } });
    if (user?.lastDailyBonus && isSameDay(user.lastDailyBonus)) {
      res.json({ claimed: false, message: 'Already claimed today' });
      return;
    }
    
    const bonus = await getConfigInt('daily_mission_bonus_coins', 100);
    
    const now = new Date();
    const dateKey = 'mission-' + now.toISOString().slice(0, 10);
    const clientIp = requestIp.getClientIp(req) || 'unknown';
    
    try {
      await addLedgerEntry(userId, bonus, 'DAILY_MISSION_BONUS', clientIp, dateKey);
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.json({ claimed: false, message: 'Already claimed today' });
        return;
      }
      throw error;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastDailyBonus: now,
        totalCoinsEarned: { increment: bonus },
      },
    });

    res.json({ claimed: true, coinsEarned: bonus });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const syncStreak = async (req: any, res: Response) => {
  try {
    const result = await updateStreak(req.user.id);
    res.json({ data: result });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getTransactions = async (req: any, res: Response) => {
  try {
    const ledgerEntries = await prisma.coinLedger.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
    res.json({ data: ledgerEntries });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const trackActivity = async (req: any, res: Response): Promise<void> => {
  try {
    const { currentScreen, country, acquisitionSource } = req.body;
    if (currentScreen && String(currentScreen).length > 80) {
      res.status(400).json({ error: 'currentScreen is too long' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        lastActiveAt: new Date(),
        ...(currentScreen !== undefined && { currentScreen: String(currentScreen) }),
        ...(country !== undefined && { country: String(country).slice(0, 80) }),
        ...(acquisitionSource !== undefined && { acquisitionSource: String(acquisitionSource).slice(0, 120) }),
      },
      select: { id: true, currentScreen: true, lastActiveAt: true },
    });

    res.json({ data: updated });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getNotifications = async (req: any, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.json({ data: notifications });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const markNotificationRead = async (req: any, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.notificationId as string);
    const result = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { read: true },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteAccount = async (req: any, res: Response): Promise<void> => {
  try {
    if (req.body.confirmation !== 'DELETE') {
      res.status(400).json({ error: 'Account deletion confirmation is required' });
      return;
    }
    const pendingWithdrawal = await prisma.withdrawal.findFirst({
      where: { userId: req.user.id, status: 'PENDING' },
      select: { id: true },
    });
    if (pendingWithdrawal) {
      res.status(409).json({ error: 'Resolve or cancel your pending withdrawal before deleting your account' });
      return;
    }

    const deletedIdentity = `deleted-${req.user.id}-${Date.now()}`;
    await prisma.$transaction([
      prisma.deviceFingerprint.deleteMany({ where: { userId: req.user.id } }),
      prisma.aBTestAllocation.deleteMany({ where: { userId: req.user.id } }),
      prisma.notification.deleteMany({ where: { userId: req.user.id } }),
      prisma.rewardSuggestion.deleteMany({ where: { userId: req.user.id } }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          googleId: null,
          email: `${deletedIdentity}@deleted.invalid`,
          name: 'Deleted User',
          referralCode: null,
          fcmToken: null,
          country: null,
          acquisitionSource: null,
          currentScreen: null,
          banned: true,
        },
      }),
    ]);
    res.json({ message: 'Account deleted and personal data removed' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
