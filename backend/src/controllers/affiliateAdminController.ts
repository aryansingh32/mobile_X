import { Response } from 'express';
import requestIp from 'request-ip';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';
import { addLedgerEntry } from '../services/ledgerService';

const paramInt = (value: unknown): number => parseInt(String(value ?? ''), 10);

const logAction = async (adminId: number, action: string, details: any) => {
  await prisma.auditLog.create({
    data: { adminId, action, details: JSON.stringify(details) },
  }).catch(() => undefined);
};

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

const PRODUCT_SECTIONS = ['FEATURED', 'TRENDING', 'DEALS', 'GENERAL'];

// ─────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────

export const getAdminAffiliateProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.affiliateProduct.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    res.json({ data: products });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createAffiliateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, imageUrl, price, vibReward, affiliateUrl, platform, category, section, sortOrder, isActive } = req.body;
    if (!title || !imageUrl || !affiliateUrl || price === undefined || vibReward === undefined || !platform || !category) {
      res.status(400).json({ error: 'title, imageUrl, price, vibReward, affiliateUrl, platform, and category are required' });
      return;
    }
    const validationError = validateNonNegativeInts([
      { value: vibReward, name: 'vibReward' },
      { value: sortOrder, name: 'sortOrder' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const normalizedSection = section ? String(section).trim().toUpperCase() : 'GENERAL';
    if (!PRODUCT_SECTIONS.includes(normalizedSection)) {
      res.status(400).json({ error: `section must be one of: ${PRODUCT_SECTIONS.join(', ')}` });
      return;
    }
    const product = await prisma.affiliateProduct.create({
      data: {
        title: String(title).trim().slice(0, 200),
        description: description ? String(description).trim().slice(0, 1000) : null,
        imageUrl: String(imageUrl).trim(),
        price: Number(price),
        vibReward: Number(vibReward),
        affiliateUrl: String(affiliateUrl).trim(),
        platform: String(platform).trim().toUpperCase(),
        category: String(category).trim(),
        section: normalizedSection,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        isActive: isActive ?? true,
        updatedBy: req.user.id,
      },
    });
    await logAction(req.user.id, 'CREATE_AFFILIATE_PRODUCT', { id: product.id, title: product.title });
    res.status(201).json({ data: product });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateAffiliateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.affiliateProduct.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const validationError = validateNonNegativeInts([
      { value: req.body.vibReward, name: 'vibReward' },
      { value: req.body.sortOrder, name: 'sortOrder' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const data: any = {};
    if (req.body.title !== undefined) data.title = String(req.body.title).trim().slice(0, 200);
    if (req.body.description !== undefined) data.description = req.body.description ? String(req.body.description).trim().slice(0, 1000) : null;
    if (req.body.imageUrl !== undefined) data.imageUrl = String(req.body.imageUrl).trim();
    if (req.body.price !== undefined) data.price = Number(req.body.price);
    if (req.body.vibReward !== undefined) data.vibReward = Number(req.body.vibReward);
    if (req.body.affiliateUrl !== undefined) data.affiliateUrl = String(req.body.affiliateUrl).trim();
    if (req.body.platform !== undefined) data.platform = String(req.body.platform).trim().toUpperCase();
    if (req.body.category !== undefined) data.category = String(req.body.category).trim();
    if (req.body.section !== undefined) {
      const normalizedSection = String(req.body.section).trim().toUpperCase();
      if (!PRODUCT_SECTIONS.includes(normalizedSection)) {
        res.status(400).json({ error: `section must be one of: ${PRODUCT_SECTIONS.join(', ')}` });
        return;
      }
      data.section = normalizedSection;
    }
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
    data.updatedBy = req.user.id;

    const product = await prisma.affiliateProduct.update({ where: { id }, data });
    await logAction(req.user.id, 'UPDATE_AFFILIATE_PRODUCT', { id, before, after: product });
    res.json({ data: product });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteAffiliateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.affiliateProduct.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    await prisma.affiliateProduct.delete({ where: { id } });
    await logAction(req.user.id, 'DELETE_AFFILIATE_PRODUCT', { id, deleted: before });
    res.json({ message: 'Product deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// BANNERS
// ─────────────────────────────────────────────────────────

const BANNER_LINK_TYPES = ['PRODUCT', 'CATEGORY', 'URL'];

export const getAdminAffiliateBanners = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const banners = await prisma.affiliateBanner.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ data: banners });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createAffiliateBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { imageUrl, linkType, linkValue, sortOrder, isActive } = req.body;
    if (!imageUrl || !linkType || !linkValue) {
      res.status(400).json({ error: 'imageUrl, linkType, and linkValue are required' });
      return;
    }
    const normalizedLinkType = String(linkType).trim().toUpperCase();
    if (!BANNER_LINK_TYPES.includes(normalizedLinkType)) {
      res.status(400).json({ error: `linkType must be one of: ${BANNER_LINK_TYPES.join(', ')}` });
      return;
    }
    const validationError = validateNonNegativeInts([{ value: sortOrder, name: 'sortOrder' }]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const banner = await prisma.affiliateBanner.create({
      data: {
        imageUrl: String(imageUrl).trim(),
        linkType: normalizedLinkType,
        linkValue: String(linkValue).trim(),
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        isActive: isActive ?? true,
        updatedBy: req.user.id,
      },
    });
    await logAction(req.user.id, 'CREATE_AFFILIATE_BANNER', { id: banner.id });
    res.status(201).json({ data: banner });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateAffiliateBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.affiliateBanner.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    const data: any = {};
    if (req.body.imageUrl !== undefined) data.imageUrl = String(req.body.imageUrl).trim();
    if (req.body.linkType !== undefined) {
      const normalizedLinkType = String(req.body.linkType).trim().toUpperCase();
      if (!BANNER_LINK_TYPES.includes(normalizedLinkType)) {
        res.status(400).json({ error: `linkType must be one of: ${BANNER_LINK_TYPES.join(', ')}` });
        return;
      }
      data.linkType = normalizedLinkType;
    }
    if (req.body.linkValue !== undefined) data.linkValue = String(req.body.linkValue).trim();
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
    data.updatedBy = req.user.id;

    const banner = await prisma.affiliateBanner.update({ where: { id }, data });
    await logAction(req.user.id, 'UPDATE_AFFILIATE_BANNER', { id, before, after: banner });
    res.json({ data: banner });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteAffiliateBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.affiliateBanner.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    await prisma.affiliateBanner.delete({ where: { id } });
    await logAction(req.user.id, 'DELETE_AFFILIATE_BANNER', { id, deleted: before });
    res.json({ message: 'Banner deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────
// PURCHASES (manual review + crediting)
// ─────────────────────────────────────────────────────────

const PURCHASE_STATUSES = ['PENDING', 'CONFIRMED', 'CREDITED', 'REJECTED'];

export const getAffiliatePurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, userId } = req.query;
    const where: any = {};
    if (typeof status === 'string' && status.trim()) where.status = status.trim().toUpperCase();
    if (typeof userId === 'string' && userId.trim()) where.userId = parseInt(userId, 10);

    const purchases = await prisma.affiliatePurchase.findMany({
      where,
      orderBy: { clickedAt: 'desc' },
      take: 500,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, imageUrl: true } },
      },
    });
    res.json({ data: purchases });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateAffiliatePurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.affiliatePurchase.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }
    if (before.status === 'CREDITED') {
      res.status(409).json({ error: 'Already credited — cannot edit a credited record' });
      return;
    }

    const validationError = validateNonNegativeInts([{ value: req.body.vibReward, name: 'vibReward' }]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const data: any = {};
    if (req.body.amount !== undefined) data.amount = req.body.amount === null ? null : Number(req.body.amount);
    if (req.body.vibReward !== undefined) data.vibReward = Number(req.body.vibReward);
    if (req.body.adminNotes !== undefined) data.adminNotes = req.body.adminNotes ? String(req.body.adminNotes).trim().slice(0, 1000) : null;
    if (req.body.status !== undefined) {
      const normalizedStatus = String(req.body.status).trim().toUpperCase();
      if (!PURCHASE_STATUSES.includes(normalizedStatus) || normalizedStatus === 'CREDITED') {
        res.status(400).json({ error: `status must be one of: PENDING, CONFIRMED, REJECTED (use the credit endpoint to mark CREDITED)` });
        return;
      }
      data.status = normalizedStatus;
    }

    const purchase = await prisma.affiliatePurchase.update({ where: { id }, data });
    await logAction(req.user.id, 'UPDATE_AFFILIATE_PURCHASE', { id, before, after: purchase });
    res.json({ data: purchase });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const creditAffiliatePurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const purchase = await prisma.affiliatePurchase.findUnique({ where: { id } });
    if (!purchase) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }
    if (purchase.status === 'CREDITED') {
      res.status(409).json({ error: 'This purchase has already been credited' });
      return;
    }
    if (purchase.status === 'REJECTED') {
      res.status(409).json({ error: 'This purchase was rejected — cannot credit it' });
      return;
    }

    const clientIp = requestIp.getClientIp(req) || 'unknown';
    // sessionId is derived from the purchase row's own id, so addLedgerEntry's
    // idempotencyKey (`${source}:${userId}:${sessionId}`) is unique per
    // purchase — a double-tapped Credit button (or a retry) can never pay
    // twice, same P2002-dedupe guarantee used everywhere else in the ledger.
    await addLedgerEntry(purchase.userId, purchase.vibReward, 'AFFILIATE_PURCHASE', clientIp, `affiliate-purchase-${purchase.id}`);

    const updated = await prisma.affiliatePurchase.update({
      where: { id },
      data: { status: 'CREDITED', creditedAt: new Date(), creditedBy: req.user.id },
    });
    await logAction(req.user.id, 'CREDIT_AFFILIATE_PURCHASE', { id, userId: purchase.userId, vibReward: purchase.vibReward });
    res.json({ data: updated });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'This purchase has already been credited' });
      return;
    }
    sendServerError(res, error);
  }
};
