import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { bumpConfigVersion } from './configController';
import { sendServerError } from '../utils/errorResponse';

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

const logAction = async (adminId: number, action: string, details: any) => {
  await prisma.auditLog.create({
    data: { adminId, action, details: JSON.stringify(details) },
  }).catch(() => undefined);
};

const paramString = (value: unknown): string => String(value ?? '');
const paramInt = (value: unknown): number => parseInt(paramString(value), 10);
const queryString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  return value !== undefined ? String(value) : undefined;
};

/**
 * Validates a set of {value, field, min} triples are all non-negative integers
 * (when present — undefined is allowed through, matching the existing
 * partial-update pattern). Returns the first error message, or null if clean.
 * These economy fields feed straight into client-side arithmetic (ad interval
 * randomization, wallet credits, daily-cap comparisons) with no bounds
 * checking downstream, so a bad value here silently breaks or drains a wallet.
 */
const validateNonNegativeInts = (fields: { value: unknown; name: string; min?: number }[]): string | null => {
  for (const { value, name, min = 0 } of fields) {
    if (value === undefined) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
      return `${name} must be an integer >= ${min}`;
    }
  }
  return null;
};

// ─────────────────────────────────────────────────────────
// AD PLACEMENTS CRUD
// ─────────────────────────────────────────────────────────

export const getAdPlacements = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const placements = await prisma.adPlacement.findMany({ orderBy: { screen: 'asc' } });
    res.json({ data: placements });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createAdPlacement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key, screen, adFormat, enabled, intervalMin, intervalMax, cooldownSeconds,
            maxPerSession, skipFirstNActions, adUnitKey, titleKey, descriptionKey, ctaLabelKey } = req.body;

    if (!key || !screen || !adFormat || !adUnitKey) {
      res.status(400).json({ error: 'key, screen, adFormat, and adUnitKey are required' });
      return;
    }

    const validationError = validateNonNegativeInts([
      { value: intervalMin, name: 'intervalMin' },
      { value: intervalMax, name: 'intervalMax' },
      { value: cooldownSeconds, name: 'cooldownSeconds' },
      { value: maxPerSession, name: 'maxPerSession' },
      { value: skipFirstNActions, name: 'skipFirstNActions' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    if ((intervalMin ?? 3) > (intervalMax ?? 6)) {
      res.status(400).json({ error: 'intervalMin must be <= intervalMax' });
      return;
    }

    const placement = await prisma.adPlacement.create({
      data: {
        key, screen, adFormat, enabled: enabled ?? true,
        intervalMin: intervalMin ?? 3, intervalMax: intervalMax ?? 6,
        cooldownSeconds: cooldownSeconds ?? 45, maxPerSession: maxPerSession ?? 8,
        skipFirstNActions: skipFirstNActions ?? 2, adUnitKey,
        titleKey, descriptionKey, ctaLabelKey, updatedBy: req.user.id,
      },
    });

    await logAction(req.user.id, 'CREATE_AD_PLACEMENT', { key });
    await bumpConfigVersion();
    res.status(201).json({ data: placement });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Ad placement with this key already exists' });
      return;
    }
    sendServerError(res, error);
  }
};

export const updateAdPlacement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.adPlacement.findUnique({ where: { id } });
    if (!before) { res.status(404).json({ error: 'Placement not found' }); return; }

    const { enabled, intervalMin, intervalMax, cooldownSeconds, maxPerSession,
            skipFirstNActions, titleKey, descriptionKey, ctaLabelKey } = req.body;

    const validationError = validateNonNegativeInts([
      { value: intervalMin, name: 'intervalMin' },
      { value: intervalMax, name: 'intervalMax' },
      { value: cooldownSeconds, name: 'cooldownSeconds' },
      { value: maxPerSession, name: 'maxPerSession' },
      { value: skipFirstNActions, name: 'skipFirstNActions' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const effectiveMin = intervalMin ?? before.intervalMin;
    const effectiveMax = intervalMax ?? before.intervalMax;
    if (effectiveMin > effectiveMax) {
      res.status(400).json({ error: 'intervalMin must be <= intervalMax' });
      return;
    }

    const placement = await prisma.adPlacement.update({
      where: { id },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(intervalMin !== undefined && { intervalMin }),
        ...(intervalMax !== undefined && { intervalMax }),
        ...(cooldownSeconds !== undefined && { cooldownSeconds }),
        ...(maxPerSession !== undefined && { maxPerSession }),
        ...(skipFirstNActions !== undefined && { skipFirstNActions }),
        ...(titleKey !== undefined && { titleKey }),
        ...(descriptionKey !== undefined && { descriptionKey }),
        ...(ctaLabelKey !== undefined && { ctaLabelKey }),
        updatedBy: req.user.id,
      },
    });

    await logAction(req.user.id, 'UPDATE_AD_PLACEMENT', { before, after: placement });
    await bumpConfigVersion();
    res.json({ data: placement });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteAdPlacement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.adPlacement.findUnique({ where: { id } });
    if (!before) { res.status(404).json({ error: 'Placement not found' }); return; }
    await prisma.adPlacement.delete({ where: { id } });
    await logAction(req.user.id, 'DELETE_AD_PLACEMENT', { deleted: before });
    await bumpConfigVersion();
    res.json({ message: 'Deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// AD REWARD RULES CRUD
// ─────────────────────────────────────────────────────────

export const getAdRewardRules = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rules = await prisma.adRewardRule.findMany();
    res.json({ data: rules });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateAdRewardRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adType = paramString(req.params.adType);
    const before = await prisma.adRewardRule.findUnique({ where: { adType } });
    if (!before) { res.status(404).json({ error: 'Rule not found' }); return; }

    const { coinsAwarded, dailyCapForType, cooldownSeconds, enabled, requiresFullWatch } = req.body;

    const validationError = validateNonNegativeInts([
      { value: coinsAwarded, name: 'coinsAwarded' },
      { value: dailyCapForType, name: 'dailyCapForType' },
      { value: cooldownSeconds, name: 'cooldownSeconds' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const rule = await prisma.adRewardRule.update({
      where: { adType },
      data: {
        ...(coinsAwarded !== undefined && { coinsAwarded }),
        ...(dailyCapForType !== undefined && { dailyCapForType }),
        ...(cooldownSeconds !== undefined && { cooldownSeconds }),
        ...(enabled !== undefined && { enabled }),
        ...(requiresFullWatch !== undefined && { requiresFullWatch }),
        updatedBy: req.user.id,
      },
    });

    await logAction(req.user.id, 'UPDATE_AD_REWARD_RULE', { before, after: rule });
    await bumpConfigVersion();
    res.json({ data: rule });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// DAILY CAP POLICIES CRUD
// ─────────────────────────────────────────────────────────

export const getDailyCapPolicies = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policies = await prisma.dailyCapPolicy.findMany();
    res.json({ data: policies });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateDailyCapPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = paramString(req.params.tier);
    const before = await prisma.dailyCapPolicy.findUnique({ where: { tier } });
    if (!before) { res.status(404).json({ error: 'Policy not found' }); return; }

    const { maxAdsPerDay, maxCoinsPerDay, minCooldownSeconds } = req.body;

    const validationError = validateNonNegativeInts([
      { value: maxAdsPerDay, name: 'maxAdsPerDay' },
      { value: maxCoinsPerDay, name: 'maxCoinsPerDay' },
      { value: minCooldownSeconds, name: 'minCooldownSeconds' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const policy = await prisma.dailyCapPolicy.update({
      where: { tier },
      data: {
        ...(maxAdsPerDay !== undefined && { maxAdsPerDay }),
        ...(maxCoinsPerDay !== undefined && { maxCoinsPerDay }),
        ...(minCooldownSeconds !== undefined && { minCooldownSeconds }),
      },
    });

    await logAction(req.user.id, 'UPDATE_DAILY_CAP_POLICY', { before, after: policy });
    await bumpConfigVersion();
    res.json({ data: policy });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// CONTENT STRINGS CRUD
// ─────────────────────────────────────────────────────────

export const getContentStrings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const screen = queryString(req.query.screen);
    const where = screen ? { screen } : {};
    const strings = await prisma.contentString.findMany({ where, orderBy: [{ screen: 'asc' }, { key: 'asc' }] });
    res.json({ data: strings });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateContentString = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const key = paramString(req.params.key);
    const before = await prisma.contentString.findUnique({ where: { key } });
    if (!before) {
      // Create if doesn't exist
      const { screen, value, description } = req.body;
      if (!screen || !value) { res.status(400).json({ error: 'screen and value required' }); return; }
      const created = await prisma.contentString.create({
        data: { key, screen, value, description, updatedBy: req.user.id },
      });
      await logAction(req.user.id, 'CREATE_CONTENT_STRING', { key, value });
      await bumpConfigVersion();
      res.status(201).json({ data: created });
      return;
    }

    const { value, description } = req.body;
    const updated = await prisma.contentString.update({
      where: { key },
      data: {
        ...(value !== undefined && { value }),
        ...(description !== undefined && { description }),
        updatedBy: req.user.id,
      },
    });

    await logAction(req.user.id, 'UPDATE_CONTENT_STRING', { key, before: before.value, after: value });
    await bumpConfigVersion();
    res.json({ data: updated });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const bulkUpdateContentStrings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { strings } = req.body;
    if (!Array.isArray(strings) || strings.length === 0) {
      res.status(400).json({ error: 'strings array is required' });
      return;
    }

    let updated = 0;
    for (const s of strings) {
      if (!s.key || !s.screen || !s.value) continue;
      await prisma.contentString.upsert({
        where: { key: s.key },
        update: { value: s.value, description: s.description, updatedBy: req.user.id },
        create: { key: s.key, screen: s.screen, value: s.value, description: s.description, updatedBy: req.user.id },
      });
      updated++;
    }

    await logAction(req.user.id, 'BULK_UPDATE_CONTENT_STRINGS', { count: updated });
    await bumpConfigVersion();
    res.json({ message: `Updated ${updated} content strings` });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// FEATURE FLAGS CRUD
// ─────────────────────────────────────────────────────────

export const getFeatureFlags = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const flags = await prisma.featureFlag.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
    res.json({ data: flags });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateFeatureFlag = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const key = paramString(req.params.key);
    const before = await prisma.featureFlag.findUnique({ where: { key } });
    if (!before) { res.status(404).json({ error: 'Flag not found' }); return; }

    const { enabled, rolloutPercent, description } = req.body;

    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(rolloutPercent !== undefined && { rolloutPercent: Math.min(100, Math.max(0, rolloutPercent)) }),
        ...(description !== undefined && { description }),
        updatedBy: req.user.id,
      },
    });

    await logAction(req.user.id, 'UPDATE_FEATURE_FLAG', { key, before: before.enabled, after: flag.enabled });
    await bumpConfigVersion();
    res.json({ data: flag });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// SCREEN SECTIONS CRUD
// ─────────────────────────────────────────────────────────

export const getScreenSections = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const screen = paramString(req.params.screen);
    const sections = await prisma.screenSection.findMany({
      where: { screen },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: sections });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateScreenSections = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const screen = paramString(req.params.screen);
    const { sections } = req.body;
    if (!Array.isArray(sections)) {
      res.status(400).json({ error: 'sections array is required' });
      return;
    }

    for (const s of sections) {
      await prisma.screenSection.upsert({
        where: { screen_sectionKey: { screen, sectionKey: s.sectionKey } },
        update: {
          enabled: s.enabled ?? true,
          sortOrder: s.sortOrder ?? 0,
          layoutVariant: s.layoutVariant ?? 'default',
        },
        create: {
          screen, sectionKey: s.sectionKey,
          enabled: s.enabled ?? true,
          sortOrder: s.sortOrder ?? 0,
          layoutVariant: s.layoutVariant ?? 'default',
        },
      });
    }

    await logAction(req.user.id, 'UPDATE_SCREEN_SECTIONS', { screen, count: sections.length });
    await bumpConfigVersion();
    res.json({ message: `Updated ${sections.length} sections for ${screen}` });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// AD ANALYTICS
// ─────────────────────────────────────────────────────────

export const getAdFunnelAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const placementKey = queryString(req.query.placementKey);
    const where: any = { timestamp: { gte: since } };
    if (placementKey) where.placementKey = placementKey;

    const events = await prisma.adEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
    });

    const funnel: Record<string, number> = {};
    for (const e of events) {
      funnel[e.eventType] = e._count.id;
    }

    res.json({ data: { period: `${days}d`, funnel } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getFillRateAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.adEvent.groupBy({
      by: ['adType', 'eventType'],
      where: {
        timestamp: { gte: since },
        eventType: { in: ['REQUESTED', 'LOADED', 'FAILED_TO_LOAD'] },
      },
      _count: { id: true },
    });

    const byType: Record<string, { requested: number; loaded: number; failed: number; fillRate: number }> = {};
    for (const e of events) {
      const bucket = byType[e.adType] ?? { requested: 0, loaded: 0, failed: 0, fillRate: 0 };
      if (e.eventType === 'REQUESTED') bucket.requested = e._count.id;
      if (e.eventType === 'LOADED') bucket.loaded = e._count.id;
      if (e.eventType === 'FAILED_TO_LOAD') bucket.failed = e._count.id;
      byType[e.adType] = bucket;
    }
    for (const t of Object.keys(byType)) {
      const bucket = byType[t];
      if (!bucket) continue;
      bucket.fillRate = bucket.requested > 0 ? Math.round((bucket.loaded / bucket.requested) * 100) : 0;
    }

    res.json({ data: { period: `${days}d`, byType } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getRevenueEstimate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [earnedRewards, coinToInrConfig, totalCoinsOut] = await Promise.all([
      prisma.adEvent.count({
        where: { eventType: 'EARNED_REWARD', timestamp: { gte: since } },
      }),
      prisma.appConfig.findUnique({ where: { key: 'coin_to_inr_rate' } }),
      prisma.coinLedger.aggregate({
        where: { amount: { gt: 0 }, timestamp: { gte: since } },
        _sum: { amount: true },
      }),
    ]);

    const coinToInr = parseFloat(coinToInrConfig?.value || '0.10');
    const totalCoinsPaidOut = totalCoinsOut._sum.amount || 0;
    const payoutCostINR = totalCoinsPaidOut * coinToInr;

    res.json({
      data: {
        period: `${days}d`,
        totalAdRewards: earnedRewards,
        totalCoinsPaidOut,
        payoutCostINR: Math.round(payoutCostINR * 100) / 100,
        coinToInrRate: coinToInr,
        note: 'Ad revenue estimate requires AdMob API integration — this shows payout cost only',
      },
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
