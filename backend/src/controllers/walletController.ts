import { Response } from 'express';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import prisma from '../config/db';
import { addLedgerEntry, getBalance } from '../services/ledgerService';
import { AuthRequest } from '../middlewares/authMiddleware';
import requestIp from 'request-ip';
import { sendServerError, sendControllerError } from '../utils/errorResponse';

export const getCatalog = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.catalogItem.findMany({
      where: { active: true },
      orderBy: { coinCost: 'asc' },
    });
    const codeCounts = await prisma.catalogCode.groupBy({
      by: ['catalogItemId', 'status'],
      where: { catalogItemId: { in: items.map((item) => item.id) } },
      _count: { _all: true },
    });
    const countsByItem = new Map<number, Record<string, number>>();
    for (const row of codeCounts) {
      const counts = countsByItem.get(row.catalogItemId) ?? {};
      counts[row.status] = row._count._all;
      countsByItem.set(row.catalogItemId, counts);
    }
    res.json({
      data: items.map((item) => {
        const availableCodes = countsByItem.get(item.id)?.AVAILABLE ?? 0;
        const issuedCodes = countsByItem.get(item.id)?.ISSUED ?? 0;
        const hasCodeInventory = availableCodes + issuedCodes > 0;
        const availableStock = hasCodeInventory ? availableCodes : item.stock;
        return {
          ...item,
          availableStock,
          soldOut: availableStock !== -1 && availableStock <= 0,
          codeBacked: hasCodeInventory,
        };
      }),
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { catalogItemId, destinationId, size, color, deliveryAddress, mobileNumber } = req.body;

    if (!catalogItemId) {
      res.status(400).json({ error: 'catalogItemId is required' });
      return;
    }

    // Get min withdrawal from config
    const minConfig = await prisma.appConfig.findUnique({ where: { key: 'min_withdrawal_coins' } });
    const minCoins = minConfig ? parseInt(minConfig.value) : 500;

    const clientIp = requestIp.getClientIp(req) || 'unknown';
    const withdrawal = await prisma.$transaction(async (tx) => {
      const item = await tx.catalogItem.findUnique({ where: { id: catalogItemId } });
      if (!item || !item.active) {
        throw Object.assign(new Error('Catalog item not found or inactive'), { statusCode: 404 });
      }

      if (item.stock !== -1 && item.stock <= 0) {
        throw Object.assign(new Error('Item is out of stock'), { statusCode: 400 });
      }

      if (item.coinCost < minCoins) {
        throw Object.assign(new Error(`Minimum withdrawal is ${minCoins} coins`), { statusCode: 400 });
      }

      const availableCode = item.type === 'VOUCHER'
        ? await tx.catalogCode.findFirst({
            where: { catalogItemId: item.id, status: 'AVAILABLE' },
            orderBy: { createdAt: 'asc' },
          })
        : null;
      if (item.type === 'VOUCHER' && !availableCode) {
        throw Object.assign(new Error('Voucher is out of stock'), { statusCode: 400 });
      }

      const cleanDestinationId = destinationId ? String(destinationId).trim().slice(0, 160) : '';
      if (item.type !== 'VOUCHER' && item.type !== 'PHYSICAL' && !cleanDestinationId) {
        throw Object.assign(new Error('destinationId is required for this reward'), { statusCode: 400 });
      }

      if (item.type === 'PHYSICAL') {
        if (!deliveryAddress || !mobileNumber) {
          throw Object.assign(new Error('Delivery address and mobile number are required for physical items'), { statusCode: 400 });
        }
      }

      const idempotencyKey = `withdrawal-request:${userId}:${catalogItemId}:${crypto.randomUUID()}`;
      await addLedgerEntry(
        userId,
        -item.coinCost,
        'WITHDRAWAL',
        clientIp,
        idempotencyKey,
        undefined,
        tx
      );

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amountCoins: item.coinCost,
          amountInr: item.inrValue,
          status: availableCode ? 'APPROVED' : 'PENDING',
          riskScoreAtTime: req.user?.riskScore || 0,
          payoutMethod: item.type,
          destinationId: availableCode ? 'CATALOG_CODE_INVENTORY' : cleanDestinationId,
          catalogItemId: item.id,
          size: item.type === 'PHYSICAL' ? size : null,
          color: item.type === 'PHYSICAL' ? color : null,
          deliveryAddress: item.type === 'PHYSICAL' ? deliveryAddress : null,
          mobileNumber: item.type === 'PHYSICAL' ? mobileNumber : null,
        },
      });

      let issuedCode: typeof availableCode = null;
      if (availableCode) {
        const codeUpdate = await tx.catalogCode.updateMany({
          where: { id: availableCode.id, status: 'AVAILABLE' },
          data: {
            status: 'ISSUED',
            withdrawalId: withdrawal.id,
            issuedAt: new Date(),
          },
        });
        if (codeUpdate.count !== 1) {
          throw Object.assign(new Error('Voucher is out of stock'), { statusCode: 400 });
        }
        issuedCode = availableCode;
      }

      // Trigger referral commission for all withdrawals (Voucher or Pending UPI)
      const referral = await tx.referral.findFirst({
        where: { referredId: userId }
      });
      if (referral) {
        // Fetch percentages from admin config, default to 10, 15, 20
        const t1Conf = await tx.appConfig.findUnique({ where: { key: 'referral_percent_tier_1' } });
        const t2Conf = await tx.appConfig.findUnique({ where: { key: 'referral_percent_tier_2' } });
        const t3Conf = await tx.appConfig.findUnique({ where: { key: 'referral_percent_tier_3' } });
        
        const tierPercentages: Record<number, number> = { 
          1: t1Conf ? parseInt(t1Conf.value)/100 : 0.10, 
          2: t2Conf ? parseInt(t2Conf.value)/100 : 0.15, 
          3: t3Conf ? parseInt(t3Conf.value)/100 : 0.20 
        };
        
        const percentage = tierPercentages[referral.tier] ?? (t1Conf ? parseInt(t1Conf.value)/100 : 0.10);
        const referrerBonus = Math.floor(item.coinCost * percentage);
        
        if (referrerBonus > 0) {
          await addLedgerEntry(
            referral.referrerId,
            referrerBonus,
            `REFERRAL_TIER_${referral.tier}_BONUS`,
            'system',
            `withdrawal:${withdrawal.id}`,
            undefined,
            tx
          );
        }
      }

      if (item.stock !== -1) {
        const stockUpdate = await tx.catalogItem.updateMany({
          where: { id: item.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (stockUpdate.count !== 1) {
          throw Object.assign(new Error('Item is out of stock'), { statusCode: 400 });
        }
      }

      return { withdrawal, issuedCode };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    res.json({
      message: withdrawal.issuedCode ? 'Voucher code issued' : 'Withdrawal request submitted',
      data: withdrawal.withdrawal,
      redemptionCode: withdrawal.issuedCode
        ? {
            code: withdrawal.issuedCode.code,
            serialNumber: withdrawal.issuedCode.serialNumber,
            note: withdrawal.issuedCode.note,
          }
        : null,
    });
  } catch (error: any) {
    sendControllerError(res, error);
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const entries = await prisma.coinLedger.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = entries.length > limit;
    const data = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    res.json({ data, nextCursor });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const postSuggestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || message.length > 200) {
      res.status(400).json({ error: 'Message is required and must be under 200 characters' });
      return;
    }

    const suggestion = await prisma.rewardSuggestion.create({
      data: { userId, message },
    });

    res.json({ message: 'Suggestion submitted', data: suggestion });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const suggestions = await prisma.rewardSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: suggestions });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getMyWithdrawals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        catalogCode: { select: { code: true, serialNumber: true, note: true } },
        catalogItem: { select: { name: true, imageUrl: true, type: true } },
      }
    });

    const hasMore = withdrawals.length > limit;
    const data = hasMore ? withdrawals.slice(0, limit) : withdrawals;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    res.json({ data, nextCursor });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
