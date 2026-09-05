import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { invalidateCache } from '../middlewares/cacheMiddleware';
import { runIngestionNow, syncSingleSource } from '../services/newsIngestionService';
import { searchYoutubeShorts } from '../services/youtubeService';
import { sendServerError } from '../utils/errorResponse';
import { logFraud } from '../services/fraudService';

// ─────────────────────────────────────────────────────────
// PUBLIC CONFIG (safe, non-critical values only)
// ─────────────────────────────────────────────────────────

const SAFE_PUBLIC_KEYS = [
  'ad_rewarded_coins', 'ad_rewarded_interstitial_coins', 'ad_rewarded_discover_coins',
  'daily_ad_cap', 'daily_bonus_coins', 'min_withdrawal_coins', 'coin_to_inr_rate',
];

const ADMOB_CONFIG_KEYS = [
  'admob_android_app_id',
  'admob_android_app_open_ad_unit_id',
  'admob_android_rewarded_card_ad_unit_id',
  'admob_android_rewarded_discover_ad_unit_id',   // Separate unit for Discover rewarded
  'admob_android_rewarded_interstitial_card_ad_unit_id',
  'admob_android_game_completion_ad_unit_id',
  'admob_android_interstitial_nav_ad_unit_id',    // Nav transition interstitial
  'admob_android_wallet_interstitial_ad_unit_id',  // Wallet switch interstitial
  'admob_android_native_ad_unit_id',
  'admob_android_news_banner_ad_unit_id',
] as const;

const AD_UNIT_KEY_LOOKUP: Record<string, string> = {
  APP_OPEN: 'admob_android_app_open_ad_unit_id',
  REWARDED: 'admob_android_rewarded_card_ad_unit_id',
  // REWARDED_DISCOVER uses its own dedicated unit for better fill rate tracking
  REWARDED_DISCOVER: 'admob_android_rewarded_discover_ad_unit_id',
  REWARDED_CARD: 'admob_android_rewarded_card_ad_unit_id',
  REWARDED_INTERSTITIAL: 'admob_android_rewarded_interstitial_card_ad_unit_id',
  REWARDED_INTERSTITIAL_CARD: 'admob_android_rewarded_interstitial_card_ad_unit_id',
  REWARDED_INTERSTITIAL_SHORTS: 'admob_android_rewarded_interstitial_card_ad_unit_id',  // Fix key alias
  GAME_COMPLETION: 'admob_android_game_completion_ad_unit_id',
  INTERSTITIAL_NAV: 'admob_android_interstitial_nav_ad_unit_id',  // Fixed: was wrongly aliased to GAME_COMPLETION
  WALLET_INTERSTITIAL: 'admob_android_wallet_interstitial_ad_unit_id',
  NATIVE: 'admob_android_native_ad_unit_id',
  NATIVE_DISCOVER: 'admob_android_native_ad_unit_id',
  NEWS_BANNER: 'admob_android_news_banner_ad_unit_id',
  BANNER_ARTICLE: 'admob_android_news_banner_ad_unit_id',
};

export const getPublicConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [configs, maintenanceFlag] = await Promise.all([
      prisma.appConfig.findMany({ where: { key: { in: SAFE_PUBLIC_KEYS } } }),
      // The full /api/config/remote payload (which carries feature flags
      // generally) requires auth, so a logged-out/pre-onboarding user never
      // fetches it — meaning maintenance mode was previously invisible to
      // anyone who isn't already logged in. This endpoint needs no auth, so
      // it's the one place that can reach them before login.
      prisma.featureFlag.findUnique({ where: { key: 'maintenance_mode' } }),
    ]);
    const result: Record<string, string | boolean> = {};
    for (const c of configs) {
      result[c.key] = c.value;
    }
    result.maintenanceMode = maintenanceFlag?.enabled ?? false;
    res.json(result);
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getAllConfig = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
    res.json({ data: configs });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const key = String(req.params.key || '').trim();
    const value = String(req.body.value ?? '').trim();

    if (!/^[a-z0-9_]{2,80}$/.test(key)) {
      res.status(400).json({ error: 'Invalid config key' });
      return;
    }

    if (value.length === 0) {
      res.status(400).json({ error: 'Config value cannot be empty' });
      return;
    }

    // AppConfig has no per-key type metadata (it's a plain string k/v store used
    // for both numeric knobs like coin_to_inr_rate and free text). Use the
    // existing stored value as an implicit type oracle: if a key already holds
    // a number, refuse to overwrite it with something that no longer parses as
    // one — callers throughout the codebase do direct arithmetic on these.
    const existing = await prisma.appConfig.findUnique({ where: { key } });
    if (existing && existing.value.trim().length > 0 && Number.isFinite(Number(existing.value))) {
      if (!Number.isFinite(Number(value))) {
        res.status(400).json({ error: `Config key "${key}" currently holds a numeric value; the new value must also be numeric` });
        return;
      }
    }

    const config = await prisma.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    if (key !== 'config_version') {
      await bumpConfigVersion();
    }

    res.json({ data: config });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// ADMIN CONTENT CONFIG
// ─────────────────────────────────────────────────────────

const intParam = (value: unknown, fallback = 0): number => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CATALOG_TYPES = ['UPI', 'VOUCHER', 'PHYSICAL', 'CUSTOM'];
const CODE_STATUSES = ['AVAILABLE', 'RESERVED', 'ISSUED', 'VOID'];

export const getRssSources = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sources = await prisma.rssSource.findMany({
      orderBy: [{ active: 'desc' }, { priority: 'asc' }, { name: 'asc' }],
      include: { category: { select: { id: true, name: true } } },
    });
    res.json({ data: sources });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createRssSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, url, categoryId, active, priority, refreshInterval, language, region, isDiscoverFilter, imageUrl, sortOrder } = req.body;
    if (!name || !url) {
      res.status(400).json({ error: 'name and url are required' });
      return;
    }

    const source = await prisma.rssSource.create({
      data: {
        name: String(name),
        url: String(url),
        categoryId: categoryId ? intParam(categoryId) : null,
        active: active ?? true,
        priority: priority ? String(priority) : 'NORMAL',
        refreshInterval: refreshInterval ? intParam(refreshInterval, 300) : 300,
        language: language ? String(language) : 'en',
        region: region ? String(region) : 'Global',
        isDiscoverFilter: Boolean(isDiscoverFilter),
        imageUrl: imageUrl ? String(imageUrl) : null,
        sortOrder: sortOrder !== undefined ? intParam(sortOrder) : 0,
      },
    });
    res.status(201).json({ data: source });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'RSS source URL already exists' });
      return;
    }
    sendServerError(res, error);
  }
};

export const updateRssSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = intParam(req.params.id);
    const { categoryId, refreshInterval, ...body } = req.body;
    const source = await prisma.rssSource.update({
      where: { id },
      data: {
        ...body,
        ...(categoryId !== undefined && { categoryId: categoryId ? intParam(categoryId) : null }),
        ...(refreshInterval !== undefined && { refreshInterval: intParam(refreshInterval, 300) }),
      },
    });
    res.json({ data: source });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteRssSource = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.rssSource.delete({ where: { id: intParam(req.params.id) } });
    invalidateCache('/api/news');
    res.json({ message: 'RSS source deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getYoutubePool = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(intParam(req.query.limit, 100), 200);
    const items = await prisma.youtubeVideoPool.findMany({
      orderBy: { addedAt: 'desc' },
      take: limit,
      include: { category: { select: { id: true, name: true } } },
    });
    res.json({ data: items });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const uploadYoutubePool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoIds, categoryId } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      res.status(400).json({ error: 'videoIds array is required' });
      return;
    }

    const cleanIds = Array.from(new Set(
      videoIds.map(v => String(v || '').trim()).filter(id => YOUTUBE_VIDEO_ID_RE.test(id))
    ));

    let added = 0;
    if (cleanIds.length > 0) {
      const result = await prisma.youtubeVideoPool.createMany({
        data: cleanIds.map(videoId => ({
          videoId,
          categoryId: categoryId ? intParam(categoryId) : null,
        })),
        skipDuplicates: true,
      });
      added = result.count;
    }

    invalidateCache('/api/shorts');
    res.json({ message: `${added} videos added`, data: { added } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateYoutubePoolItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: any = {};
    if (req.body.isTrending !== undefined) data.isTrending = Boolean(req.body.isTrending);
    if (req.body.active !== undefined) data.active = Boolean(req.body.active);
    if (req.body.categoryId !== undefined) data.categoryId = req.body.categoryId ? intParam(req.body.categoryId) : null;

    const item = await prisma.youtubeVideoPool.update({
      where: { id: intParam(req.params.id) },
      data,
    });
    
    invalidateCache('/api/shorts');
    res.json({ data: item });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteYoutubePoolItem = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.youtubeVideoPool.delete({ where: { id: intParam(req.params.id) } });
    invalidateCache('/api/shorts');
    res.json({ message: 'Video removed from pool' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const importYoutubeSearch = async (req: Request, res: Response): Promise<void> => {
  const startedAt = Date.now();
  const query = String(req.body.query || '').trim();
  const count = intParam(req.body.count, 20);
  const categoryId = intParam(req.body.categoryId);

  if (query.length < 2 || query.length > 120) {
    res.status(400).json({ error: 'Search query must be between 2 and 120 characters' });
    return;
  }
  if (count < 1 || count > 100) {
    res.status(400).json({ error: 'count must be between 1 and 100' });
    return;
  }
  if (!categoryId) {
    res.status(400).json({ error: 'A category is required' });
    return;
  }

  const log = await prisma.youtubeImportLog.create({
    data: { query, categoryId, requestedCount: count, status: 'FAILED' },
  });

  try {
    const fetched = await searchYoutubeShorts(query, count);
    const existing = await prisma.youtubeVideoPool.findMany({
      where: { videoId: { in: fetched.map((video) => video.videoId) } },
      select: { videoId: true },
    });
    const existingIds = new Set(existing.map((video) => video.videoId));
    const toAdd = fetched.filter(video => !existingIds.has(video.videoId)).slice(0, count);
    let added = 0;

    if (toAdd.length > 0) {
      const result = await prisma.youtubeVideoPool.createMany({
        data: toAdd.map(video => ({
          videoId: video.videoId,
          title: video.title,
          channelTitle: video.channelTitle ?? null,
          durationSeconds: video.duration,
          categoryId,
          source: 'SEARCH',
          sourceQuery: query,
        })),
        skipDuplicates: true,
      });
      added = result.count;
    }

    const duplicatesSkipped = fetched.filter((video) => existingIds.has(video.videoId)).length;
    const status = added >= count ? 'SUCCESS' : 'PARTIAL';
    await prisma.youtubeImportLog.update({
      where: { id: log.id },
      data: {
        fetchedCount: fetched.length,
        addedCount: added,
        duplicatesSkipped,
        invalidSkipped: Math.max(0, count - added - duplicatesSkipped),
        status,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });
    invalidateCache('/api/shorts');
    res.json({ message: `${added} videos added to the pool`, data: { requested: count, fetched: fetched.length, added, duplicatesSkipped } });
  } catch (error: any) {
    await prisma.youtubeImportLog.update({
      where: { id: log.id },
      data: { error: error.message, completedAt: new Date(), durationMs: Date.now() - startedAt },
    }).catch(() => undefined);
    res.status(502).json({ error: error.message });
  }
};

export const getYoutubeImportLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(intParam(req.query.limit, 25), 100);
    const logs = await prisma.youtubeImportLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: { category: { select: { id: true, name: true } } },
    });
    res.json({ data: logs });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getAdminCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await prisma.catalogItem.findMany({ orderBy: { createdAt: 'desc' } });
    const codeCounts = await prisma.catalogCode.groupBy({
      by: ['catalogItemId', 'status'],
      _count: { _all: true },
    });
    const countsByItem = new Map<number, Record<string, number>>();
    for (const row of codeCounts) {
      const counts = countsByItem.get(row.catalogItemId) ?? {};
      counts[row.status] = row._count._all;
      countsByItem.set(row.catalogItemId, counts);
    }
    res.json({
      data: items.map((item) => ({
        ...item,
        codeCounts: {
          available: countsByItem.get(item.id)?.AVAILABLE ?? 0,
          reserved: countsByItem.get(item.id)?.RESERVED ?? 0,
          issued: countsByItem.get(item.id)?.ISSUED ?? 0,
          void: countsByItem.get(item.id)?.VOID ?? 0,
        },
      })),
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, imageUrl, type, coinCost, inrValue, stock } = req.body;
    if (!name || !type || coinCost === undefined || inrValue === undefined) {
      res.status(400).json({ error: 'name, type, coinCost, and inrValue are required' });
      return;
    }
    const normalizedType = String(type).trim().toUpperCase();
    if (!CATALOG_TYPES.includes(normalizedType)) {
      res.status(400).json({ error: 'Invalid catalog item type' });
      return;
    }
    const item = await prisma.catalogItem.create({
      data: {
        name: String(name).trim().slice(0, 120),
        description: description ? String(description).trim().slice(0, 500) : null,
        imageUrl: imageUrl ? String(imageUrl).trim().slice(0, 500) : null,
        type: normalizedType,
        coinCost: Math.max(1, intParam(coinCost)),
        inrValue: Number(inrValue),
        stock: stock !== undefined ? intParam(stock, -1) : -1,
      },
    });
    res.status(201).json({ data: item });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: any = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim().slice(0, 120);
    if (req.body.description !== undefined) data.description = req.body.description ? String(req.body.description).trim().slice(0, 500) : null;
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl ? String(req.body.imageUrl).trim().slice(0, 500) : null;
    if (req.body.type !== undefined) {
      const normalizedType = String(req.body.type).trim().toUpperCase();
      if (!CATALOG_TYPES.includes(normalizedType)) {
        res.status(400).json({ error: 'Invalid catalog item type' });
        return;
      }
      data.type = normalizedType;
    }
    if (req.body.coinCost !== undefined) data.coinCost = Math.max(1, intParam(req.body.coinCost));
    if (req.body.inrValue !== undefined) data.inrValue = Number(req.body.inrValue);
    if (req.body.active !== undefined) data.active = Boolean(req.body.active);
    if (req.body.stock !== undefined) data.stock = intParam(req.body.stock, -1);

    const item = await prisma.catalogItem.update({
      where: { id: intParam(req.params.id) },
      data,
    });
    res.json({ data: item });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getCatalogCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const catalogItemId = intParam(req.params.id);
    const codes = await prisma.catalogCode.findMany({
      where: { catalogItemId },
      orderBy: { createdAt: 'desc' },
      include: {
        withdrawal: {
          select: {
            id: true,
            userId: true,
            status: true,
            requestedAt: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    res.json({ data: codes });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const addCatalogCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const catalogItemId = intParam(req.params.id);
    const rawCodes = Array.isArray(req.body.codes) ? req.body.codes : String(req.body.codes || '').split('\n');
    const normalized = rawCodes
      .map((entry: any) => {
        if (typeof entry === 'object' && entry !== null) {
          return {
            code: String(entry.code || '').trim(),
            serialNumber: entry.serialNumber ? String(entry.serialNumber).trim() : null,
            note: entry.note ? String(entry.note).trim() : null,
          };
        }
        const [code, serialNumber] = String(entry).split(',').map((part) => part.trim());
        return { code, serialNumber: serialNumber || null, note: null };
      })
      .filter((entry: any) => entry.code.length > 0 && entry.code.length <= 300);

    if (normalized.length === 0) {
      res.status(400).json({ error: 'No valid codes provided' });
      return;
    }

    const created = await prisma.catalogCode.createMany({
      data: normalized.map((entry: any) => ({
        catalogItemId: Number(catalogItemId),
        code: entry.code,
        serialNumber: entry.serialNumber,
        note: entry.note,
      })),
      skipDuplicates: true,
    });

    await prisma.catalogItem.update({
      where: { id: catalogItemId },
      data: { stock: { increment: created.count } },
    }).catch(() => undefined);

    res.status(201).json({ data: { added: created.count, skipped: normalized.length - created.count } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateCatalogCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: any = {};
    if (req.body.status !== undefined) {
      const status = String(req.body.status).trim().toUpperCase();
      if (!CODE_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Invalid code status' });
        return;
      }
      data.status = status;
    }
    if (req.body.code !== undefined) data.code = String(req.body.code).trim().slice(0, 300);
    if (req.body.serialNumber !== undefined) data.serialNumber = req.body.serialNumber ? String(req.body.serialNumber).trim().slice(0, 120) : null;
    if (req.body.note !== undefined) data.note = req.body.note ? String(req.body.note).trim().slice(0, 300) : null;

    const code = await prisma.catalogCode.update({
      where: { id: intParam(req.params.codeId) },
      data,
    });
    res.json({ data: code });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteCatalogCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await prisma.catalogCode.findUnique({ where: { id: intParam(req.params.codeId) } });
    if (!code) {
      res.status(404).json({ error: 'Catalog code not found' });
      return;
    }
    if (code.status === 'ISSUED') {
      res.status(409).json({ error: 'Issued codes cannot be deleted' });
      return;
    }
    await prisma.catalogCode.delete({ where: { id: code.id } });
    res.json({ message: 'Catalog code deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.catalogItem.delete({ where: { id: intParam(req.params.id) } });
    res.json({ message: 'Catalog item deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getAdminSuggestions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const suggestions = await prisma.rewardSuggestion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });
    res.json({ data: suggestions });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateSuggestionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }
    const suggestion = await prisma.rewardSuggestion.update({
      where: { id: intParam(req.params.id) },
      data: { status: String(status) },
    });
    res.json({ data: suggestion });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getNewsDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [activeSources, totalArticles, articlesToday, failedFeeds, totalCategories, lastSync] = await Promise.all([
      prisma.rssSource.count({ where: { active: true } }),
      prisma.newsArticle.count(),
      prisma.newsArticle.count({ where: { fetchedAt: { gte: startOfDay } } }),
      prisma.rssSource.count({ where: { lastSyncStatus: 'FAILED', active: true } }),
      prisma.category.count(),
      prisma.feedSyncLog.findFirst({ orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
    ]);
    res.json({ data: { activeSources, totalArticles, totalCategories, articlesToday, failedFeeds, lastSyncAt: lastSync?.completedAt || null } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const triggerFullSync = async (_req: Request, res: Response): Promise<void> => {
  try {
    runIngestionNow().catch(console.error);
    res.json({ message: 'Sync started in background' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const triggerSourceSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await syncSingleSource(intParam(req.params.sourceId));
    res.json({ data: result });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getAdminNewsArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(intParam(req.query.limit, 50), 100);
    const offset = intParam(req.query.offset, 0);
    const search = String(req.query.search || '').trim();
    const where = search
      ? {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
            { sourceName: { contains: search } },
          ],
        }
      : undefined;
    const [articles, total] = await Promise.all([
      prisma.newsArticle.findMany({
        ...(where ? { where } : {}),
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { source: { select: { name: true } }, category: { select: { name: true } } },
      }),
      where ? prisma.newsArticle.count({ where }) : prisma.newsArticle.count(),
    ]);
    res.json({ data: articles, total });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateAdminNewsArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.newsArticle.update({
      where: { id: intParam(req.params.id) },
      data: req.body,
    });
    invalidateCache('/api/news');
    res.json({ data: article });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteAdminNewsArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.newsArticle.delete({ where: { id: intParam(req.params.id) } });
    invalidateCache('/api/news');
    res.json({ message: 'Article deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getFeedSyncLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(intParam(req.query.limit, 50), 100);
    const logs = await prisma.feedSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: { source: { select: { name: true } } },
    });
    res.json({ data: logs });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { sources: true, articles: true, youtubeVideos: true } } },
    });
    res.json({ data: categories });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, icon, sortOrder, active, isDiscoverFilter, imageUrl } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const category = await prisma.category.create({
      data: {
        name: String(name),
        icon: icon ? String(icon) : 'news',
        sortOrder: sortOrder !== undefined ? intParam(sortOrder) : 0,
        active: active ?? true,
        isDiscoverFilter: Boolean(isDiscoverFilter),
        imageUrl: imageUrl ? String(imageUrl) : null,
      },
    });
    res.status(201).json({ data: category });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.update({
      where: { id: intParam(req.params.id) },
      data: req.body,
    });
    res.json({ data: category });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id: intParam(req.params.id) } });
    invalidateCache('/api/news');
    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// REMOTE CONFIG (authenticated, consolidated payload)
// ─────────────────────────────────────────────────────────

export const getRemoteConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clientVersion = parseInt(req.query.version as string) || 0;

    // Check current version
    const versionConfig = await prisma.appConfig.findUnique({ where: { key: 'config_version' } });
    const serverVersion = versionConfig ? parseInt(versionConfig.value) : 1;

    if (clientVersion >= serverVersion) {
      res.json({ unchanged: true, version: serverVersion });
      return;
    }

    // Fetch all config data in parallel
    const [adPlacements, adRewardRules, dailyCapPolicies, contentStrings, featureFlags, screenSections, admobConfigs] =
      await Promise.all([
        prisma.adPlacement.findMany({ orderBy: { screen: 'asc' } }),
        prisma.adRewardRule.findMany(),
        prisma.dailyCapPolicy.findMany(),
        prisma.contentString.findMany({ where: { locale: 'en', variant: null } }),
        prisma.featureFlag.findMany(),
        prisma.screenSection.findMany({ orderBy: [{ screen: 'asc' }, { sortOrder: 'asc' }] }),
        prisma.appConfig.findMany({ where: { key: { in: [...ADMOB_CONFIG_KEYS] } } }),
      ]);

    // Transform ad placements to keyed map
    const placementsMap: Record<string, any> = {};
    for (const p of adPlacements) {
      placementsMap[p.key] = {
        screen: p.screen, adFormat: p.adFormat, enabled: p.enabled,
        intervalMin: p.intervalMin, intervalMax: p.intervalMax,
        cooldownSeconds: p.cooldownSeconds, maxPerSession: p.maxPerSession,
        skipFirstNActions: p.skipFirstNActions, adUnitKey: p.adUnitKey,
        titleKey: p.titleKey, descriptionKey: p.descriptionKey, ctaLabelKey: p.ctaLabelKey,
      };
    }

    // Transform reward rules to keyed map
    const rewardRulesMap: Record<string, any> = {};
    for (const r of adRewardRules) {
      rewardRulesMap[r.adType] = {
        coinsAwarded: r.coinsAwarded, dailyCapForType: r.dailyCapForType,
        cooldownSeconds: r.cooldownSeconds, enabled: r.enabled,
        requiresFullWatch: r.requiresFullWatch,
      };
    }

    // Transform cap policies to keyed map
    const capPoliciesMap: Record<string, any> = {};
    for (const cp of dailyCapPolicies) {
      capPoliciesMap[cp.tier] = {
        maxAdsPerDay: cp.maxAdsPerDay, maxCoinsPerDay: cp.maxCoinsPerDay,
        minCooldownSeconds: cp.minCooldownSeconds,
      };
    }

    // Flatten content strings to key→value
    const contentMap: Record<string, string> = {};
    for (const cs of contentStrings) {
      contentMap[cs.key] = cs.value;
    }

    // Flatten feature flags to key→enabled
    const flagsMap: Record<string, boolean> = {};
    for (const ff of featureFlags) {
      // Apply rollout percentage (deterministic by userId hash)
      if (ff.rolloutPercent < 100 && req.user?.id) {
        const hash = req.user.id % 100;
        flagsMap[ff.key] = ff.enabled && hash < ff.rolloutPercent;
      } else {
        flagsMap[ff.key] = ff.enabled;
      }
    }

    // Group screen sections by screen
    const sectionsMap: Record<string, any[]> = {};
    for (const ss of screenSections) {
      const screenSectionsForScreen = sectionsMap[ss.screen] ?? [];
      screenSectionsForScreen.push({
        sectionKey: ss.sectionKey, enabled: ss.enabled,
        sortOrder: ss.sortOrder, layoutVariant: ss.layoutVariant,
      });
      sectionsMap[ss.screen] = screenSectionsForScreen;
    }

    const admobConfigMap = Object.fromEntries(admobConfigs.map((config) => [config.key, config.value]));
    const adUnitsMap: Record<string, { android?: string }> = {};
    for (const [adUnitKey, configKey] of Object.entries(AD_UNIT_KEY_LOOKUP)) {
      const android = admobConfigMap[configKey];
      if (android) {
        adUnitsMap[adUnitKey] = { android };
      }
    }

    res.json({
      version: serverVersion,
      adPlacements: placementsMap,
      adUnits: adUnitsMap,
      adMobAppIds: {
        android: admobConfigMap.admob_android_app_id,
      },
      adRewardRules: rewardRulesMap,
      dailyCapPolicies: capPoliciesMap,
      contentStrings: contentMap,
      featureFlags: flagsMap,
      screenSections: sectionsMap,
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// AD EVENT INGESTION (lightweight, fire-and-forget)
// ─────────────────────────────────────────────────────────

const VALID_EVENT_TYPES = ['REQUESTED', 'LOADED', 'FAILED_TO_LOAD', 'SHOWN', 'CLICKED', 'EARNED_REWARD', 'DISMISSED', 'ABANDONED'];

// Defaults if the AppConfig rows below haven't been seeded yet — all of
// these are overridable per-deployment via AppConfig (ad_farming_* keys),
// same pattern as every other tunable in this file.
const AD_FARMING_DEFAULTS = {
  windowMinutes: 60,
  minSample: 5,
  abandonThreshold: 0.6,
  penaltyBaseSeconds: 300,
  penaltyMaxSeconds: 1800,
  fraudSample: 10,
  fraudThreshold: 0.85,
};

const getAdFarmingConfig = async () => {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: [
      'ad_farming_window_minutes', 'ad_farming_min_sample', 'ad_farming_abandon_threshold',
      'ad_farming_penalty_base_seconds', 'ad_farming_penalty_max_seconds',
      'ad_farming_fraud_sample', 'ad_farming_fraud_threshold',
    ] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    windowMinutes: Number(map.ad_farming_window_minutes) || AD_FARMING_DEFAULTS.windowMinutes,
    minSample: Number(map.ad_farming_min_sample) || AD_FARMING_DEFAULTS.minSample,
    abandonThreshold: Number(map.ad_farming_abandon_threshold) || AD_FARMING_DEFAULTS.abandonThreshold,
    penaltyBaseSeconds: Number(map.ad_farming_penalty_base_seconds) || AD_FARMING_DEFAULTS.penaltyBaseSeconds,
    penaltyMaxSeconds: Number(map.ad_farming_penalty_max_seconds) || AD_FARMING_DEFAULTS.penaltyMaxSeconds,
    fraudSample: Number(map.ad_farming_fraud_sample) || AD_FARMING_DEFAULTS.fraudSample,
    fraudThreshold: Number(map.ad_farming_fraud_threshold) || AD_FARMING_DEFAULTS.fraudThreshold,
  };
};

export const reportAdEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placementKey, adType, eventType, screen, sessionId, errorCode, latencyMs } = req.body;

    if (!placementKey || !adType || !eventType || !screen || !sessionId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      res.status(400).json({ error: 'Invalid eventType' });
      return;
    }

    await prisma.adEvent.create({
      data: {
        userId: req.user.id,
        placementKey: String(placementKey).slice(0, 100),
        adType: String(adType).slice(0, 50),
        eventType,
        screen: String(screen).slice(0, 30),
        sessionId: String(sessionId).slice(0, 100),
        errorCode: errorCode ? String(errorCode).slice(0, 100) : null,
        latencyMs: latencyMs ? Math.min(Math.max(0, parseInt(latencyMs)), 30000) : null,
      },
    });

    // Ad-farming guard: only worth computing on the events that actually
    // signal a possible abuse pattern (closing without earning). Checking
    // on every event (including REQUESTED/LOADED) would be wasted work for
    // no benefit, since those alone don't indicate abandonment.
    // Farming detection only makes sense for rewarded placements — a plain
    // (non-rewarded) interstitial, like the game-completion or nav-transition
    // ones, is *always* dismissed with no EARNED_REWARD counterpart by
    // design, so treating that as "abandonment" would misfire on completely
    // normal usage and end up penalizing a user's legitimate rewarded ads
    // elsewhere in the app for behavior that had nothing to do with farming.
    const isRewardedAdType = typeof adType === 'string' && adType.startsWith('REWARDED');

    if (isRewardedAdType && (eventType === 'DISMISSED' || eventType === 'ABANDONED')) {
      const farmingConfig = await getAdFarmingConfig();
      const since = new Date(Date.now() - farmingConfig.windowMinutes * 60 * 1000);

      // Session-based, not a raw count of DISMISSED events: a legitimate
      // full ad watch also fires DISMISSED right after EARNED_REWARD (the
      // ad UI still has to close), so every honest watch would otherwise
      // look identical to an abandoned one. What actually indicates
      // farming is a session (sessionId) that was dismissed/abandoned
      // *without* ever earning a reward.
      const recentEvents = await prisma.adEvent.findMany({
        where: {
          userId: req.user.id,
          timestamp: { gte: since },
          adType: { startsWith: 'REWARDED' },
          eventType: { in: ['EARNED_REWARD', 'DISMISSED', 'ABANDONED'] },
        },
        select: { sessionId: true, eventType: true },
      });

      const earnedSessions = new Set(recentEvents.filter(e => e.eventType === 'EARNED_REWARD').map(e => e.sessionId));
      const dismissedSessions = new Set(
        recentEvents.filter(e => e.eventType === 'DISMISSED' || e.eventType === 'ABANDONED').map(e => e.sessionId),
      );
      const allSessions = new Set([...earnedSessions, ...dismissedSessions]);
      const abandonedWithoutReward = [...dismissedSessions].filter(sid => !earnedSessions.has(sid)).length;

      const sample = allSessions.size;
      if (sample >= farmingConfig.minSample) {
        const abandonRatio = abandonedWithoutReward / sample;

        if (abandonRatio >= farmingConfig.abandonThreshold) {
          // Escalating penalty: the further past minSample the abandon
          // count runs, the longer the backoff, capped at penaltyMaxSeconds.
          const strikes = Math.max(1, abandonedWithoutReward - farmingConfig.minSample + 1);
          const penaltySeconds = Math.min(farmingConfig.penaltyBaseSeconds * strikes, farmingConfig.penaltyMaxSeconds);
          const penaltyUntil = Date.now() + penaltySeconds * 1000;

          if (sample >= farmingConfig.fraudSample && abandonRatio >= farmingConfig.fraudThreshold) {
            await logFraud(req.user.id, 'AD_FARMING_SUSPECTED', 'HIGH', {
              abandonRatio, sample, abandonedWithoutReward, windowMinutes: farmingConfig.windowMinutes,
            }).catch(() => undefined);
          }

          res.status(200).json({ penaltyUntil, penaltySeconds });
          return;
        }
      }
    }

    res.status(204).end();
  } catch (error: any) {
    // Fire-and-forget — don't crash on analytics failures
    res.status(204).end();
  }
};

// ─────────────────────────────────────────────────────────
// HELPER: bump config version on any admin change
// ─────────────────────────────────────────────────────────

export const bumpConfigVersion = async (): Promise<number> => {
  await prisma.appConfig.upsert({
    where: { key: 'config_version' },
    update: {},
    create: { key: 'config_version', value: '1' },
  });
  const current = await prisma.appConfig.findUnique({ where: { key: 'config_version' } });
  const newVersion = (parseInt(current?.value || '0') || 0) + 1;
  await prisma.appConfig.update({
    where: { key: 'config_version' },
    data: { value: String(newVersion) },
  });
  return newVersion;
};
