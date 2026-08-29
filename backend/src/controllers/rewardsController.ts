import { Response } from 'express';
import crypto from 'crypto';
import https from 'https';
import prisma from '../config/db';
import { addLedgerEntry } from '../services/ledgerService';
import { addExp } from '../services/expService';
import { AuthRequest } from '../middlewares/authMiddleware';
import requestIp from 'request-ip';
import { sendServerError } from '../utils/errorResponse';
import logger from '../utils/logger';

const getConfigInt = async (key: string, fallback: number): Promise<number> => {
  const config = await prisma.appConfig.findUnique({ where: { key } });
  const parsed = config ? Number.parseInt(config.value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getConfigBoolean = async (key: string, fallback: boolean): Promise<boolean> => {
  const config = await prisma.appConfig.findUnique({ where: { key } });
  if (!config) return fallback;
  return config.value === 'true' || config.value === '1';
};

const fetchGoogleKeys = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    https.get('https://www.gstatic.com/admob/reward/verifier/keys.json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

let cachedKeys: any = null;
let keysFetchTime = 0;

const getGoogleKeys = async () => {
  if (cachedKeys && Date.now() - keysFetchTime < 24 * 60 * 60 * 1000) {
    return cachedKeys;
  }
  cachedKeys = await fetchGoogleKeys();
  keysFetchTime = Date.now();
  return cachedKeys;
};

export const handleAdMobSSV = async (req: any, res: Response): Promise<void> => {
  try {
    const urlStr = req.url; // e.g. /ssv?ad_network=...&signature=...&key_id=...
    if (!urlStr.includes('signature=') || !urlStr.includes('key_id=')) {
      res.status(400).send('Missing signature or key_id');
      return;
    }

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const signature = url.searchParams.get('signature');
    const keyId = url.searchParams.get('key_id');
    const customData = url.searchParams.get('custom_data'); // format: userId:deviceId:adType
    const transactionId = url.searchParams.get('transaction_id');

    if (!signature || !keyId || !transactionId || !customData) {
      res.status(400).send('Missing parameters');
      return;
    }

    const keys = await getGoogleKeys();
    const keyConfig = keys.keys.find((k: any) => String(k.keyId) === String(keyId));
    if (!keyConfig) {
      res.status(400).send('Unknown key_id');
      return;
    }

    const messageToVerify = urlStr.split('?')[1].split('&signature=')[0];

    const verify = crypto.createVerify('SHA256');
    verify.update(messageToVerify);
    const base64Signature = signature.replace(/-/g, '+').replace(/_/g, '/');
    const isValid = verify.verify(keyConfig.pem, base64Signature, 'base64');

    if (!isValid) {
      res.status(400).send('Invalid signature');
      return;
    }

    const [uStr, dStr, adType] = (customData as string).split(':');
    const uid = parseInt(uStr || '0');
    const type = adType || 'REWARDED';

    const rule = await prisma.adRewardRule.findUnique({ where: { adType: type } });
    if (!rule || !rule.enabled) {
        res.status(400).send('Reward disabled');
        return;
    }

    const [globalAdCount, typeAdCount, globalCoinsCount] = await Promise.all([
      prisma.coinLedger.count({
        where: {
          userId: uid,
          source: { in: ['REWARDED', 'REWARDED_INTERSTITIAL', 'REWARDED_DISCOVER', 'ROULETTE_AD'] },
          timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) },
        },
      }),
      prisma.coinLedger.count({
        where: { userId: uid, source: rule.adType, timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) } },
      }),
      prisma.coinLedger.aggregate({
        where: { userId: uid, amount: { gt: 0 }, timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) } },
        _sum: { amount: true },
      }),
    ]);

    const policy = await prisma.dailyCapPolicy.findUnique({ where: { tier: 'DEFAULT' } });
    
    if (policy && globalAdCount >= policy.maxAdsPerDay) {
      res.status(200).send('OK (Global daily ad limit reached)');
      return;
    }
    if (typeAdCount >= rule.dailyCapForType) {
      res.status(200).send('OK (Daily limit reached for this ad type)');
      return;
    }
    const earnedToday = globalCoinsCount._sum.amount || 0;
    if (policy && earnedToday + rule.coinsAwarded > policy.maxCoinsPerDay) {
      res.status(200).send('OK (Global daily coin limit reached)');
      return;
    }

    // Parity with claimAdReward: a device already flagged as rooted/emulated
    // for this user should not mint real coins just because this particular
    // ad type happens to go through Google's SSV path instead of the
    // client-claim endpoint. Log and skip the credit, but still ack 200 to
    // Google — this is our fraud gate, not a signal Google's callback failed.
    const deviceIdForCheck = dStr && dStr !== 'null' && dStr !== 'undefined' ? dStr : undefined;
    if (deviceIdForCheck) {
      const flaggedDevice = await prisma.deviceFingerprint.findFirst({
        where: {
          userId: uid,
          deviceIdHash: deviceIdForCheck,
          OR: [{ isRooted: true }, { isEmulator: true }],
        },
        select: { id: true, isRooted: true, isEmulator: true },
      });

      if (flaggedDevice) {
        await prisma.fraudIncident.create({
          data: {
            userId: uid,
            reason: 'FLAGGED_DEVICE_REWARD_CLAIM',
            severity: 'HIGH',
            metadata: JSON.stringify({
              deviceId: deviceIdForCheck,
              isRooted: flaggedDevice.isRooted,
              isEmulator: flaggedDevice.isEmulator,
              path: 'admob-ssv',
              adType: type,
            }),
          },
        }).catch(() => undefined);
        res.status(200).send('OK (Reward blocked: flagged device)');
        return;
      }
    }

    // A rule can legitimately be configured (via the admin panel) with 0 coins —
    // e.g. an ad type that only unlocks a non-monetary perk. addLedgerEntry()
    // rejects zero-amount entries by design, so skip the ledger write entirely
    // in that case instead of letting it throw and 500 the whole SSV callback.
    if (rule.coinsAwarded !== 0) {
      try {
        await addLedgerEntry(uid, rule.coinsAwarded, rule.adType, 'admob-ssv', transactionId, dStr === 'null' ? undefined : dStr);
      } catch (e: any) {
        if (e.code === 'P2002') {
          res.status(200).send('OK');
          return;
        }
        throw e;
      }

      const xpRatio = Math.max(1, await getConfigInt('xp_per_coin_ratio', 2));
      const xpGained = Math.floor(rule.coinsAwarded / xpRatio);
      if (xpGained > 0) {
        await addExp(uid, xpGained).catch(() => undefined);
      }
      await prisma.user.update({
        where: { id: uid },
        data: { totalCoinsEarned: { increment: rule.coinsAwarded } },
      }).catch(() => undefined);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('SSV Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const claimShortReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { videoId, watchSeconds, sessionId, deviceId } = req.body;

    if (!videoId || watchSeconds == null || !sessionId) {
      res.status(400).json({ error: 'videoId, watchSeconds, and sessionId are required' });
      return;
    }
    const parsedWatchSeconds = Number(watchSeconds);
    if (!Number.isFinite(parsedWatchSeconds) || parsedWatchSeconds <= 0 || parsedWatchSeconds > 60) {
      res.status(400).json({ error: 'watchSeconds must be between 1 and 60' });
      return;
    }

    // Get min watch time from config
    const minWatchConfig = await prisma.appConfig.findUnique({
      where: { key: 'short_watch_seconds_required' },
    });
    const minWatch = minWatchConfig ? parseInt(minWatchConfig.value) : 8;

    if (parsedWatchSeconds < minWatch) {
      res.status(400).json({ error: `Minimum ${minWatch} seconds of watch time required` });
      return;
    }

    const cooldownStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentClaim = await prisma.shortsSessions.findFirst({
      where: { userId, videoId: String(videoId), timestamp: { gte: cooldownStart } },
      select: { id: true },
    });
    if (recentClaim) {
      res.json({ message: 'Already rewarded for this video today', coinsEarned: 0 });
      return;
    }

    const shortDailyCap = await getConfigInt('short_daily_cap', 50);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const shortsWatchedToday = await prisma.coinLedger.count({
      where: { userId, source: 'SHORT_WATCH', timestamp: { gte: todayStart } },
    });
    
    if (shortsWatchedToday >= shortDailyCap) {
      res.json({ message: 'Daily limit reached for short videos', coinsEarned: 0 });
      return;
    }

    // Get reward amount from config
    const rewardConfig = await prisma.appConfig.findUnique({
      where: { key: 'short_watch_reward_coins' },
    });
    let rewardCoins = rewardConfig ? parseInt(rewardConfig.value) : 0;

    // Hard ceiling: YouTube API Services Developer Policy prohibits
    // incentivizing/rewarding users for watching YouTube content. The
    // config default is 0, but it's an admin-editable AppConfig row — this
    // makes that safe by construction, not just by convention. A nonzero
    // reward is only ever honored if a second, explicitly-named flag
    // confirms someone actually signed off on the policy risk; flipping
    // short_watch_reward_coins alone can never pay out real coins again.
    if (rewardCoins > 0) {
      const legalReviewApproved = await getConfigBoolean('short_watch_reward_coins_legal_review_approved', false);
      if (!legalReviewApproved) {
        logger.warn('short_watch_reward_coins is nonzero but legal-review flag is not set — forcing reward to 0', { configuredValue: rewardCoins });
        rewardCoins = 0;
      }
    }

    const clientIp = requestIp.getClientIp(req) || 'unknown';

    // The client provides a sessionId which MUST be used as the idempotency key to prevent replays
    const rewardSessionId = crypto.createHash('sha256').update(String(sessionId)).digest('hex');

    if (rewardCoins > 0) {
      // Server-derived key prevents parallel or replayed claims for the same video/day.
      try {
        await addLedgerEntry(userId, rewardCoins, 'SHORT_WATCH', clientIp, rewardSessionId, deviceId);
      } catch (e: any) {
        if (e.code === 'P2002') {
          // Duplicate idempotency key — already claimed
          res.json({ message: 'Already claimed', coinsEarned: 0 });
          return;
        }
        throw e;
      }
    }

    // Log the session
    await prisma.shortsSessions.create({
      data: { userId, videoId: String(videoId), watchSeconds: Math.floor(parsedWatchSeconds), coinsEarned: rewardCoins },
    });

    res.json({ message: rewardCoins > 0 ? 'Reward claimed' : 'Session tracked', coinsEarned: rewardCoins });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const claimAdReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { adType, adSessionId, deviceId } = req.body;

    if (!adType || !adSessionId) {
      res.status(400).json({ error: 'adType and adSessionId are required' });
      return;
    }

    // 1. Fetch Ad Reward Rule & Daily Cap Policy
    const [rule, policy] = await Promise.all([
      prisma.adRewardRule.findUnique({ where: { adType } }),
      prisma.dailyCapPolicy.findUnique({ where: { tier: 'DEFAULT' } }),
    ]);

    if (!rule) {
      // This usually means the seed script hasn't been run yet.
      // Run: npm run seed:ad-config in the backend to create all required rules.
      res.status(400).json({ error: `No reward rule configured for ad type '${adType}'. Run the ad config seed script.` });
      return;
    }

    if (!rule.enabled) {
      res.status(400).json({ error: 'Ad reward is disabled for this format' });
      return;
    }

    if (!policy) {
      res.status(500).json({ error: 'Missing daily cap policy. Run the ad config seed script.' });
      return;
    }

    // Block client claims for SSV-enabled ad types
    if (['REWARDED', 'REWARDED_INTERSTITIAL', 'REWARDED_DISCOVER', 'ROULETTE_AD'].includes(adType)) {
       res.status(403).json({ error: 'This ad type uses Server-Side Verification. Client claims are disabled.' });
       return;
    }

    // 2. Enforce Daily Caps (Global and Per-Type)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [globalAdCount, typeAdCount, globalCoinsCount] = await Promise.all([
      prisma.coinLedger.count({
        where: {
          userId,
          source: { in: ['REWARDED', 'REWARDED_INTERSTITIAL', 'REWARDED_DISCOVER', 'ROULETTE_AD'] },
          timestamp: { gte: todayStart },
        },
      }),
      prisma.coinLedger.count({
        where: { userId, source: rule.adType, timestamp: { gte: todayStart } },
      }),
      prisma.coinLedger.aggregate({
        where: { userId, amount: { gt: 0 }, timestamp: { gte: todayStart } },
        _sum: { amount: true },
      }),
    ]);

    if (globalAdCount >= policy.maxAdsPerDay) {
      res.status(429).json({ error: 'Global daily ad limit reached' });
      return;
    }
    if (typeAdCount >= rule.dailyCapForType) {
      res.status(429).json({ error: `Daily limit reached for ${adType}` });
      return;
    }
    const earnedToday = globalCoinsCount._sum.amount || 0;
    if (earnedToday + rule.coinsAwarded > policy.maxCoinsPerDay) {
      res.status(429).json({ error: 'Global daily coin limit reached' });
      return;
    }

    // 3. Enforce Cooldowns (Global and Per-Type)
    const lastAdAny = await prisma.coinLedger.findFirst({
      where: { userId, source: { in: ['REWARDED', 'REWARDED_INTERSTITIAL', 'REWARDED_DISCOVER', 'ROULETTE_AD'] } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true, source: true },
    });

    if (lastAdAny) {
      const secondsSinceLastAny = (Date.now() - lastAdAny.timestamp.getTime()) / 1000;
      
      // Global cooldown check
      if (secondsSinceLastAny < policy.minCooldownSeconds) {
        await prisma.fraudIncident.create({
          data: {
            userId, reason: 'AD_REWARD_TOO_FAST', severity: 'MEDIUM',
            metadata: JSON.stringify({ adType, secondsSinceLastAny, cooldownSeconds: policy.minCooldownSeconds, type: 'global' }),
          },
        }).catch(() => undefined);
        res.status(429).json({ error: 'Too soon since last ad' });
        return;
      }

      // Per-type cooldown check (only if the last ad was of this type)
      if (lastAdAny.source === rule.adType && secondsSinceLastAny < rule.cooldownSeconds) {
        await prisma.fraudIncident.create({
          data: {
            userId, reason: 'AD_REWARD_TOO_FAST', severity: 'MEDIUM',
            metadata: JSON.stringify({ adType, secondsSinceLastAny, cooldownSeconds: rule.cooldownSeconds, type: 'specific' }),
          },
        }).catch(() => undefined);
        res.status(429).json({ error: 'Too soon since last ad of this type' });
        return;
      }
    }

    if (deviceId) {
      const flaggedDevice = await prisma.deviceFingerprint.findFirst({
        where: {
          userId,
          deviceIdHash: String(deviceId),
          OR: [{ isRooted: true }, { isEmulator: true }],
        },
        select: { id: true, isRooted: true, isEmulator: true },
      });

      if (flaggedDevice) {
        await prisma.fraudIncident.create({
          data: {
            userId,
            reason: 'FLAGGED_DEVICE_REWARD_CLAIM',
            severity: 'HIGH',
            metadata: JSON.stringify({ deviceId, isRooted: flaggedDevice.isRooted, isEmulator: flaggedDevice.isEmulator }),
          },
        }).catch(() => undefined);
        res.status(403).json({ error: 'Reward claims are blocked on this device' });
        return;
      }
    }

    const coinsEarned = rule.coinsAwarded;
    const source = rule.adType;

    const clientIp = requestIp.getClientIp(req) || 'unknown';

    // SERVER-SIDE Idempotency Key to prevent concurrency bypass
    // FIX: Client provides adSessionId, we must use it exactly to deduplicate retries.
    const finalAdSessionId = crypto.createHash('sha256').update(String(adSessionId)).digest('hex');

    // Idempotent via adSessionId
    try {
      await addLedgerEntry(userId, coinsEarned, source, clientIp, finalAdSessionId, deviceId);
    } catch (e: any) {
      if (e.code === 'P2002') {
        res.json({ message: 'Already claimed', coinsEarned: 0 });
        return;
      }
      throw e;
    }

    const xpRatio = Math.max(1, await getConfigInt('xp_per_coin_ratio', 2));
    const xpGained = Math.floor(coinsEarned / xpRatio);
    if (xpGained > 0) {
      await addExp(userId, xpGained);
    }
    await prisma.user.update({
      where: { id: userId },
      data: { totalCoinsEarned: { increment: coinsEarned } },
    }).catch(() => undefined);

    res.json({ message: 'Ad reward claimed', coinsEarned, xpGained });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getRouletteConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isEnabled = await getConfigBoolean('roulette_enabled', true);
    if (!isEnabled) {
      res.json({ success: true, data: [] });
      return;
    }

    const items = await prisma.rouletteItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
    res.json({ success: true, data: items });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const claimRouletteSpin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isEnabled = await getConfigBoolean('roulette_enabled', true);
    if (!isEnabled) {
      res.status(403).json({ error: 'Roulette is currently disabled' });
      return;
    }

    const userId = req.user.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get limits and chances
    const [rouletteDailyChances, rouletteAdsWatchedToday, rouletteSpinsToday, activeSlices] = await Promise.all([
      getConfigInt('roulette_daily_chances', 2),
      prisma.coinLedger.count({
        where: {
          userId,
          source: 'ROULETTE_AD',
          timestamp: { gte: todayStart },
        },
      }),
      // Spins are no longer coin-ledger entries (see below) — count from the
      // spin history table itself instead.
      prisma.rouletteSpinHistory.count({
        where: {
          userId,
          timestamp: { gte: todayStart },
        },
      }),
      prisma.rouletteItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    const chancesRemaining = rouletteDailyChances + rouletteAdsWatchedToday - rouletteSpinsToday;
    if (chancesRemaining <= 0) {
      res.status(429).json({ error: 'No spin chances remaining today' });
      return;
    }

    if (activeSlices.length === 0) {
      res.status(400).json({ error: 'Roulette is currently not configured' });
      return;
    }

    // Select randomly based on probability weight
    const totalWeight = activeSlices.reduce((sum, s) => sum + s.probability, 0);
    const randomVal = crypto.randomBytes(4).readUInt32LE(0) / 0xffffffff;
    let randomNum = randomVal * totalWeight;
    
    let sliceIndex = 0;
    for (let i = 0; i < activeSlices.length; i++) {
      const slice = activeSlices[i];
      if (!slice) continue;
      randomNum -= slice.probability;
      if (randomNum < 0) {
        sliceIndex = i;
        break;
      }
    }

    const selectedSlice = activeSlices[sliceIndex];
    if (!selectedSlice) {
      res.status(500).json({ error: 'Failed to determine roulette outcome' });
      return;
    }

    // NOTE: The roulette wheel is a chance-based mechanic (weighted random slice
    // selection). Crediting real, withdrawable coins for a chance outcome is what
    // Google Play's Real-Money Gambling policy targets, regardless of licensing —
    // so this reward is deliberately NOT added to the coin ledger (which backs the
    // cash-withdrawable balance via getBalance()/CoinLedger). It converts entirely
    // to XP instead: still a meaningful, exciting reward (contributes to level,
    // streak flavor, leaderboard rank) but never becomes real money. Do not
    // reintroduce an addLedgerEntry(..., 'ROULETTE_SPIN', ...) call here without a
    // legal review — see tos_compliance_audit.md / playstore_tos_audit_report.md.
    const prizeValue = selectedSlice.rewardCoins;

    // Log the spin. This no longer needs strict cross-request idempotency —
    // since a spin can't mint cash anymore, the worst case of a duplicate
    // request is a small extra XP grant (further bounded by chancesRemaining
    // being recomputed from a fresh count on every call), not a financial
    // double-spend, so a plain insert is sufficient.
    await prisma.rouletteSpinHistory.create({
      data: {
        userId,
        rouletteItemId: selectedSlice.id,
        coinsAwarded: 0,
        spinType: rouletteSpinsToday >= rouletteDailyChances ? 'AD_REWARD' : 'FREE',
      },
    });

    // The slice's configured "prize value" becomes XP 1:1 — no coin/cash path.
    const xpGained = Math.max(0, Math.floor(prizeValue));
    if (xpGained > 0) {
      await addExp(userId, xpGained);
    }

    res.json({
      success: true,
      coinsEarned: 0,
      xpGained,
      sliceIndex,
      sliceName: selectedSlice.label,
      chancesRemaining: chancesRemaining - 1,
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
