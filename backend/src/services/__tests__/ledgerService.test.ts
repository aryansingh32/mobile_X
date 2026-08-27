// Regression tests for the shadow-ban balance exclusion fix.
//
// Bug: shadow-banned users' rewards are written to the ledger with a
// `SHADOW_<source>` prefix instead of being dropped, so admins can audit
// what was attempted. But getBalance() and the withdrawal debit check both
// used to sum *all* CoinLedger rows for a user regardless of that prefix —
// meaning a shadow-banned user's fraudulent rewards still counted toward
// their real, cash-withdrawable balance. That defeats the entire point of
// shadow-banning. These tests lock in the fix: SHADOW_-prefixed rows must
// never count toward balance or be spendable via a debit.

// uuid ships ESM-only builds that Jest's default CJS transform can't parse;
// it's only used on the fallback (no sessionId) path, which these tests
// don't exercise, so a trivial mock is sufficient.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

jest.mock('../../config/db', () => ({
  __esModule: true,
  default: {
    coinLedger: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../config/db';
import { getBalance, addLedgerEntry } from '../ledgerService';

const mockedPrisma = prisma as unknown as {
  coinLedger: { aggregate: jest.Mock; create: jest.Mock };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

describe('ledgerService — shadow-ban balance exclusion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('queries with a filter that excludes SHADOW_-prefixed sources', async () => {
      mockedPrisma.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: 250 } });

      const balance = await getBalance(1);

      expect(balance).toBe(250);
      expect(mockedPrisma.coinLedger.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 1,
            NOT: { source: { startsWith: 'SHADOW_' } },
          }),
        })
      );
    });

    it('returns 0 when there are no ledger rows', async () => {
      mockedPrisma.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: null } });
      expect(await getBalance(1)).toBe(0);
    });
  });

  describe('addLedgerEntry', () => {
    const runInTransaction = (db: any) => (fn: (tx: any) => Promise<any>) => fn(db);

    it('rejects a debit that would only be covered by SHADOW_ rewards', async () => {
      // Simulate: a shadow-banned user has 500 coins from SHADOW_REWARDED
      // (fraud, doesn't count) and 10 legitimate coins from before the ban.
      // The effective, non-shadow balance is 10 — so a 100-coin withdrawal
      // debit must be rejected even though the raw ledger sum is 510.
      mockedPrisma.user.findUnique.mockResolvedValue({ shadowBanned: true });
      mockedPrisma.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: 10 } }); // post-exclusion sum
      mockedPrisma.$transaction.mockImplementation(runInTransaction(mockedPrisma));

      await expect(
        addLedgerEntry(1, -100, 'WITHDRAWAL', '1.2.3.4', 'session-1')
      ).rejects.toThrow('Insufficient coin balance');

      expect(mockedPrisma.coinLedger.create).not.toHaveBeenCalled();
      // The balance check itself must also exclude SHADOW_ sources.
      expect(mockedPrisma.coinLedger.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            NOT: { source: { startsWith: 'SHADOW_' } },
          }),
        })
      );
    });

    it('allows a debit covered by legitimate (non-shadow) balance', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ shadowBanned: false });
      mockedPrisma.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
      mockedPrisma.coinLedger.create.mockResolvedValue({ id: 1 });
      mockedPrisma.$transaction.mockImplementation(runInTransaction(mockedPrisma));

      await addLedgerEntry(1, -100, 'WITHDRAWAL', '1.2.3.4', 'session-2');

      expect(mockedPrisma.coinLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: -100, source: 'WITHDRAWAL' }),
        })
      );
    });

    it('prefixes credits with SHADOW_ for shadow-banned users, without blocking them', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ shadowBanned: true });
      mockedPrisma.coinLedger.create.mockResolvedValue({ id: 2 });
      mockedPrisma.$transaction.mockImplementation(runInTransaction(mockedPrisma));

      await addLedgerEntry(1, 50, 'REWARDED', '1.2.3.4', 'session-3');

      expect(mockedPrisma.coinLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 50, source: 'SHADOW_REWARDED' }),
        })
      );
    });

    it('rejects a zero-amount entry', async () => {
      await expect(addLedgerEntry(1, 0, 'REWARDED', '1.2.3.4', 'session-4')).rejects.toThrow(
        'Ledger amount must be a non-zero integer'
      );
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
