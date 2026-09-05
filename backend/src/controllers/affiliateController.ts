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

export const getAffiliateProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { section, category } = req.query;
    const where: any = { isActive: true };
    if (typeof section === 'string' && section.trim()) where.section = section.trim().toUpperCase();
    if (typeof category === 'string' && category.trim()) where.category = category.trim();

    const products = await prisma.affiliateProduct.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ data: products });
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

    res.json({ data: { affiliateUrl: product.affiliateUrl } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
