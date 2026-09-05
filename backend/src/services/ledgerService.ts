import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

type LedgerClient = PrismaClient | Prisma.TransactionClient;

// Rewards credited while a user is shadow-banned are written with a
// `SHADOW_` source prefix (see writeLedgerEntry below) instead of being
// silently dropped, so admins can still audit exactly what a shadow-banned
// user "earned". But that only works as an anti-fraud control if those rows
// never count toward real, spendable/withdrawable balance — every balance
// read (and the withdrawal debit check) MUST exclude them, or shadow-banning
// does nothing but relabel the fraud.
const EXCLUDE_SHADOW_SOURCES: Prisma.CoinLedgerWhereInput = {
  NOT: { source: { startsWith: 'SHADOW_' } },
};

const sumEffectiveBalance = async (client: LedgerClient, userId: number): Promise<number> => {
  const result = await client.coinLedger.aggregate({
    _sum: { amount: true },
    where: { userId, ...EXCLUDE_SHADOW_SOURCES },
  });
  return result._sum.amount || 0;
};

export const getBalance = async (userId: number): Promise<number> => sumEffectiveBalance(prisma, userId);

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
    // FOR UPDATE locks this user's row for the rest of the surrounding
    // transaction. Without it, two concurrent debits (a double-tapped
    // withdrawal, two ad-reward callbacks racing) can both run
    // sumEffectiveBalance() before either commits its INSERT, both see the
    // same pre-debit balance, and both pass the insufficient-balance check
    // below — a classic TOCTOU overdraft. The lock forces the second
    // transaction to wait for the first to commit, so it re-reads the
    // post-debit balance instead of racing against it. Every caller of
    // addLedgerEntry runs inside a real transaction (either the internal
    // one below or a `tx` passed in by the caller), so this lock is always
    // held for the write that follows, not released early.
    const rows = await db.$queryRaw<{ shadowBanned: boolean }[]>`
      SELECT "shadowBanned" FROM "User" WHERE id = ${userId} FOR UPDATE
    `;
    const user = rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    if (amount < 0) {
      const balance = await sumEffectiveBalance(db, userId);
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
