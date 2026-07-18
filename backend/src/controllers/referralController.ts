import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { sendServerError } from '../utils/errorResponse';

function generateReferralCode(): string {
  return 'RF' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

export const getReferralCode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    let user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create referral code if user doesn't have one
    if (!user.referralCode) {
      const code = generateReferralCode();
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
    }

    const appUrl = process.env.PUBLIC_APP_URL || 'https://reelflow.app';
    const shareLink = `${appUrl.replace(/\/$/, '')}/invite/${user.referralCode}`;
    res.json({ data: { referralCode: user.referralCode, shareLink } });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getReferralStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: { select: { name: true, createdAt: true } },
      },
    });

    // Calculate total earned from referral bonuses
    const referralEarnings = await prisma.coinLedger.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        source: { startsWith: 'REFERRAL' },
      },
    });

    const currentReferral = await prisma.referral.findFirst({
      where: { referrerId: userId },
      orderBy: { tier: 'desc' },
    });

    res.json({
      data: {
        totalReferrals: referrals.length,
        tier: currentReferral?.tier || 1,
        earnedCoins: referralEarnings._sum.amount || 0,
        referrals: referrals.map((r) => ({
          name: r.referred.name,
          joinDate: r.referred.createdAt,
          tier: r.tier,
        })),
      },
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const applyReferral = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Referral code is required' });
      return;
    }

    // Check if user already has a referrer
    const existingReferral = await prisma.referral.findUnique({
      where: { referredId: userId },
    });
    if (existingReferral) {
      res.status(400).json({ error: 'You have already applied a referral code' });
      return;
    }

    // Find the referrer
    const referrer = await prisma.user.findFirst({
      where: { referralCode: code },
    });
    if (!referrer) {
      res.status(404).json({ error: 'Invalid referral code' });
      return;
    }

    if (referrer.id === userId) {
      res.status(400).json({ error: 'Cannot use your own referral code' });
      return;
    }

    try {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: userId,
          referralCode: code,
        },
      });
    } catch (error: any) {
      // referredId is @unique — this is the authoritative guard against a
      // duplicate apply raced in between the check above and this write.
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'You have already applied a referral code' });
        return;
      }
      throw error;
    }

    res.json({ message: 'Referral code applied successfully' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
