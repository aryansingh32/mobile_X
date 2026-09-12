import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

// How long a user must wait before a repeat "Buy" tap on the same product
// creates another pending row — nothing rewards on click (VIB is credited
// manually by an admin after checking a real purchase), so this exists only
// to keep the admin purchase queue from filling with rapid duplicate taps,
// not as a fraud/economy control.
const CLICK_COOLDOWN_MS = 5 * 60 * 1000;

const DEFAULT_AMAZON_ASSOCIATE_TAG = 'ascend0ab-21';
const AMAZON_HOSTNAME_RE = /(^|\.)amazon\.[a-z.]+$/i;

const getAmazonAssociateTag = async (): Promise<string> => {
  const config = await prisma.appConfig.findUnique({ where: { key: 'amazon_associate_tag' } });
  return config?.value?.trim() || DEFAULT_AMAZON_ASSOCIATE_TAG;
};

// Admins paste raw Amazon product links (see AffiliateProducts admin page) —
// most won't remember to append the store's own associate tag on every
// single link, and a missing tag means the click generates zero commission.
// This appends `tag=<store id>` server-side (once, at read time) for any
// Amazon URL that doesn't already carry one, so the admin-entered link and
// the actual outbound/tracked link can differ without anyone having to edit
// every product by hand. Non-Amazon platforms (Flipkart/OTHER) and URLs that
// already specify a tag are left untouched.
const withAmazonTag = (affiliateUrl: string, platform: string, tag: string): string => {
  if (platform !== 'AMAZON') return affiliateUrl;
  try {
    const url = new URL(affiliateUrl);
    if (!AMAZON_HOSTNAME_RE.test(url.hostname)) return affiliateUrl;
    if (url.searchParams.has('tag')) return affiliateUrl;
    url.searchParams.set('tag', tag);
    return url.toString();
  } catch {
    // Not a parseable absolute URL — leave whatever the admin entered as-is
    // rather than guessing at string concatenation.
    return affiliateUrl;
  }
};

export const getAffiliateProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { section, category } = req.query;
    const where: any = { isActive: true };
    if (typeof section === 'string' && section.trim()) where.section = section.trim().toUpperCase();
    if (typeof category === 'string' && category.trim()) where.category = category.trim();

    const [products, tag] = await Promise.all([
      prisma.affiliateProduct.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      getAmazonAssociateTag(),
    ]);
    const data = products.map((p) => ({ ...p, affiliateUrl: withAmazonTag(p.affiliateUrl, p.platform, tag) }));
    res.json({ data });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getAffiliateBanners = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const banners = await prisma.affiliateBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: banners });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const trackAffiliateClick = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;
    const id = parseInt(productId, 10);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }

    const product = await prisma.affiliateProduct.findUnique({ where: { id } });
    if (!product || !product.isActive) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const userId = req.user.id;
    const recent = await prisma.affiliatePurchase.findFirst({
      where: {
        userId,
        productId: id,
        clickedAt: { gte: new Date(Date.now() - CLICK_COOLDOWN_MS) },
      },
      orderBy: { clickedAt: 'desc' },
    });

    if (!recent) {
      await prisma.$transaction([
        prisma.affiliatePurchase.create({
          data: {
            userId,
            productId: id,
            productTitle: product.title,
            vibReward: product.vibReward,
            status: 'PENDING',
          },
        }),
        prisma.affiliateProduct.update({
          where: { id },
          data: { clickCount: { increment: 1 } },
        }),
      ]);
    }

    const tag = await getAmazonAssociateTag();
    res.json({ data: { affiliateUrl: withAmazonTag(product.affiliateUrl, product.platform, tag) } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
