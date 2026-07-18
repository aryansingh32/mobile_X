import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

type LedgerClient = PrismaClient | Prisma.TransactionClient;

export const getBalance = async (userId: number): Promise<number> => {
  const result = await prisma.coinLedger.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
    },
  });
  return result._sum.amount || 0;
};

const hashValue = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const addLedgerEntry = async (
  userId: number,
  amount: number,
  source: string,
  ipHash: string,
  sessionId?: string,
  deviceId?: string,
  client?: LedgerClient
) => {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('Ledger amount must be a non-zero integer');
  }

  const idempotencyKey = sessionId
    ? `${source}:${userId}:${sessionId}`
    : `${source}:${userId}:${uuidv4()}`;

  const writeLedgerEntry = async (db: LedgerClient) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { shadowBanned: true },
    });

    if (!user) {
      throw new Error('User not found');
    }
  
    if (amount < 0) {
      const currentBalance = await db.coinLedger.aggregate({
        _sum: { amount: true },
        where: { userId },
      });
      const balance = currentBalance._sum.amount || 0;
      if (balance + amount < 0) {
        throw new Error('Insufficient coin balance');
      }
    }

    const finalSource = user.shadowBanned ? `SHADOW_${source}` : source;

    return db.coinLedger.create({
      data: {
        userId,
        amount,
        source: finalSource,
        idempotencyKey,
        sessionId: sessionId || idempotencyKey,
        deviceId: deviceId ?? null,
        ipHash: hashValue(ipHash || 'unknown'),
      }
    });
  };

  const entry = client
    ? await writeLedgerEntry(client)
    : await prisma.$transaction(async (tx) => writeLedgerEntry(tx));

  return entry;
};
