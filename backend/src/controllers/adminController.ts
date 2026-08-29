import { sendToUser } from '../services/notificationService';
import { Request, Response } from 'express';
import prisma from '../config/db';
import { addLedgerEntry, getBalance } from '../services/ledgerService';
import requestIp from 'request-ip';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sendServerError } from '../utils/errorResponse';

const execFileAsync = promisify(execFile);

const logAdminAction = async (req: Request, action: string, details: string) => {
  await prisma.auditLog.create({
    data: { action, details, adminId: (req as any).user?.id ?? null } 
  });
};

/**
 * Lightweight identity/role check for the admin panel to call once on load
 * (and after any 401), instead of only trusting "a token string exists in
 * localStorage" client-side. Already gated by the router-level
 * `authenticate + authorizeAdmin` in routes/admin.ts, so simply reaching
 * this handler at all confirms both a valid, unexpired token AND a current
 * admin role — req.user is re-fetched from the DB on every request (see
 * authMiddleware.ts), so a demoted/banned admin is rejected immediately,
 * not just whenever their old token happens to expire.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  res.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
};

const SORTABLE_USER_FIELDS = new Set(['createdAt', 'lastActiveAt', 'trustScore', 'riskScore', 'name']);

// Parses the /admin/users query string into a Prisma `where` — shared by the
// list endpoint and the bulk-action "select everything matching this filter"
// path so the two can never disagree about which users a filter matches.
const buildUserListWhere = (query: Request['query']) => {
  const search = String(query.search || '').trim();
  const numericId = /^\d+$/.test(search) ? Number(search) : null;

  const banned = query.banned === 'true' ? true : query.banned === 'false' ? false : undefined;
  const shadowBanned = query.shadowBanned === 'true' ? true : query.shadowBanned === 'false' ? false : undefined;
  const minTrust = query.minTrust !== undefined ? parseInt(query.minTrust as string) : undefined;
  const maxTrust = query.maxTrust !== undefined ? parseInt(query.maxTrust as string) : undefined;
  const minRisk = query.minRisk !== undefined ? parseInt(query.minRisk as string) : undefined;
  const maxRisk = query.maxRisk !== undefined ? parseInt(query.maxRisk as string) : undefined;
  const country = typeof query.country === 'string' && query.country.trim() ? query.country.trim() : undefined;

  const clauses: any[] = [];
  if (search) {
    clauses.push({
      OR: [
        ...(numericId ? [{ id: numericId }] : []),
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    });
  }
  if (banned !== undefined) clauses.push({ banned });
  if (shadowBanned !== undefined) clauses.push({ shadowBanned });
  if (country !== undefined) clauses.push({ country });
  if (Number.isFinite(minTrust) || Number.isFinite(maxTrust)) {
    clauses.push({
      trustScore: {
        ...(Number.isFinite(minTrust) ? { gte: minTrust } : {}),
        ...(Number.isFinite(maxTrust) ? { lte: maxTrust } : {}),
      },
    });
  }
  if (Number.isFinite(minRisk) || Number.isFinite(maxRisk)) {
    clauses.push({
      riskScore: {
        ...(Number.isFinite(minRisk) ? { gte: minRisk } : {}),
        ...(Number.isFinite(maxRisk) ? { lte: maxRisk } : {}),
      },
    });
  }

  return clauses.length > 0 ? { AND: clauses } : undefined;
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const where = buildUserListWhere(req.query);

    const sortByRaw = String(req.query.sortBy || 'createdAt');
    const sortBy = SORTABLE_USER_FIELDS.has(sortByRaw) ? sortByRaw : 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        ...(where ? { where } : {}),
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortDir },
        // Full device/fraud-log rows are only needed on the single-user
        // detail view (getUserIntelligence) — the list only needs enough to
        // render a risk badge, not every row, so this stays cheap at 10k+
        // rows per page load instead of shipping every device fingerprint
        // for every user in the page.
        include: {
          _count: { select: { devices: true, fraudLogs: true } },
        },
      }),
      prisma.user.count({ ...(where ? { where } : {}) }),
    ]);

    const userIds = users.map((u) => u.id);
    const balances = userIds.length > 0
      ? await prisma.coinLedger.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _sum: { amount: true },
        })
      : [];
    const balanceByUserId = new Map(balances.map((row) => [row.userId, row._sum.amount || 0]));
    const usersWithBalance = users.map((u) => ({ ...u, coins: balanceByUserId.get(u.id) || 0 }));

    res.json({ data: usersWithBalance, total, limit, offset });
  } catch (error: any) { sendServerError(res, error); }
};

const BULK_USER_ACTIONS = {
  ban: { banned: true },
  unban: { banned: false },
  shadowban: { shadowBanned: true },
  unshadowban: { shadowBanned: false },
} as const;

export const bulkUpdateUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, action } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: 'userIds must be a non-empty array' });
      return;
    }
    if (userIds.length > 5000) {
      res.status(400).json({ error: 'Too many users in one request (max 5000) — filter down and retry' });
      return;
    }
    const patch = BULK_USER_ACTIONS[action as keyof typeof BULK_USER_ACTIONS];
    if (!patch) {
      res.status(400).json({ error: `Invalid action. Must be one of: ${Object.keys(BULK_USER_ACTIONS).join(', ')}` });
      return;
    }

    const ids = userIds.map((id: any) => parseInt(id, 10)).filter((id: number) => Number.isInteger(id));
    const result = await prisma.user.updateMany({ where: { id: { in: ids } }, data: patch });

    await logAdminAction(req, 'BULK_UPDATE_USERS', `action=${action} count=${result.count} ids=${ids.slice(0, 50).join(',')}${ids.length > 50 ? '…' : ''}`);
    res.json({ message: `Applied "${action}" to ${result.count} user(s)`, count: result.count });
  } catch (error: any) { sendServerError(res, error); }
};

export const adjustUserBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount === 0) {
      res.status(400).json({ error: 'Amount must be a non-zero integer' });
      return;
    }

    const id = parseInt(userId as string);
    const clientIp = requestIp.getClientIp(req) || 'unknown';

    await addLedgerEntry(id, parsedAmount, 'ADMIN_ADJUSTMENT', clientIp);
    await logAdminAction(req, 'ADJUST_BALANCE', `Adjusted user ${id} by ${parsedAmount}. Reason: ${reason || 'not provided'}`);
    
    const newBalance = await getBalance(id);
    res.json({ message: 'Balance adjusted successfully', balance: newBalance });
  } catch (error: any) { sendServerError(res, error); }
};

export const updateUserMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { trustScore, riskScore, banned, shadowBanned } = req.body;
    const id = parseInt(userId as string);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(trustScore !== undefined && { trustScore }),
        ...(riskScore !== undefined && { riskScore }),
        ...(banned !== undefined && { banned }),
        ...(shadowBanned !== undefined && { shadowBanned })
      }
    });

    await logAdminAction(req, 'UPDATE_USER_METRICS', `Updated metrics for user ${id}`);
    res.json({ message: 'User metrics updated', data: updatedUser });
  } catch (error: any) { sendServerError(res, error); }
};

export const getWithdrawals = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const where = status ? { status } : undefined;

    const withdrawals = await prisma.withdrawal.findMany({
      ...(where ? { where } : {}),
      take: limit,
      skip: offset,
      orderBy: { requestedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        catalogCode: { select: { code: true, serialNumber: true, note: true, status: true } },
        catalogItem: { select: { name: true, type: true } },
      }
    });
    const total = await prisma.withdrawal.count({ ...(where ? { where } : {}) });
    res.json({ data: withdrawals, total, limit, offset });
  } catch (error: any) { sendServerError(res, error); }
};

export const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { withdrawalId } = req.params;
    const { status, voucherCode, trackingId, trackingStatus } = req.body;
    if (!['APPROVED', 'REJECTED', 'SHIPPED', 'DELIVERED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }

    const id = parseInt(withdrawalId as string);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid withdrawal id' }); return;
    }

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) { res.status(404).json({ error: 'Withdrawal not found' }); return; }

    // If it's a PENDING -> APPROVED/REJECTED transition, use atomic guard
    if (withdrawal.status === 'PENDING' && (status === 'APPROVED' || status === 'REJECTED')) {
      const claim = await prisma.withdrawal.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, processedAt: new Date(), trackingId, trackingStatus },
      });
      if (claim.count !== 1) {
        res.status(409).json({ error: `Withdrawal has already been ${withdrawal.status.toLowerCase()}` });
        return;
      }

      if (status === 'REJECTED') {
        const clientIp = requestIp.getClientIp(req) || 'unknown';
        await addLedgerEntry(withdrawal.userId, withdrawal.amountCoins, 'WITHDRAWAL_REFUND', clientIp, `withdrawal:${id}`);
      } else if (status === 'APPROVED') {
        // Handle manual voucher code
        if (voucherCode && withdrawal.catalogItemId) {
           await prisma.catalogCode.create({
             data: {
               catalogItemId: withdrawal.catalogItemId,
               code: voucherCode,
               status: 'ISSUED',
               withdrawalId: id,
               issuedAt: new Date(),
               note: 'Manually issued by admin'
             }
           });
        }
        
        const referral = await prisma.referral.findFirst({
          where: { referredId: withdrawal.userId }, include: { referrer: true },
        });
        if (referral) {
          const tierPercentages: Record<number, number> = { 1: 0.10, 2: 0.15, 3: 0.20 };
          const percentage = tierPercentages[referral.tier] ?? 0.10;
          const referrerBonus = Math.floor(withdrawal.amountCoins * percentage);

          if (referrerBonus > 0) {
            await addLedgerEntry(referral.referrerId, referrerBonus, `REFERRAL_TIER_${referral.tier}_BONUS`, 'system', `withdrawal:${id}`);
          }
        }
      }
    } else {
      // Just update status and tracking for already approved items (e.g. APPROVED -> SHIPPED)
      if (status === 'REJECTED' || withdrawal.status === 'REJECTED') {
         res.status(400).json({ error: 'Cannot change status of rejected withdrawals or reject already processed withdrawals' }); return;
      }
      await prisma.withdrawal.update({
        where: { id },
        data: { status, trackingId, trackingStatus }
      });
    }

    const updated = await prisma.withdrawal.findUnique({ where: { id }, include: { catalogCode: true } });
    await logAdminAction(req, 'PROCESS_WITHDRAWAL', `${status} withdrawal ${id}`);
    res.json({ message: `Withdrawal ${status.toLowerCase()}`, data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

export const getFraudLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.fraudIncident.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ data: logs });
  } catch (error: any) { sendServerError(res, error); }
};

export const resolveFraud = async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const updated = await prisma.fraudIncident.update({
      where: { id: parseInt(logId as string) }, data: { resolved: true }
    });
    await logAdminAction(req, 'RESOLVE_FRAUD', `Resolved fraud log ${logId}`);
    res.json({ data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

export const getSystemLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logPath = path.join(__dirname, '../../logs/combined.log');
    if (!fs.existsSync(logPath)) { res.json({ data: [] }); return; }
    const { stdout } = await execFileAsync('tail', ['-n', '100', logPath], { maxBuffer: 1024 * 1024 });
    const logs = stdout.split('\n').filter(line => line.trim()).map(line => {
      try { return JSON.parse(line); } catch { return { message: line }; }
    }).reverse();
    res.json({ data: logs });
  } catch (error: any) { sendServerError(res, error); }
};

// --- Google-Grade Admin Endpoints ---

// Keys whose values must never be returned in full over HTTP, even to a
// SUPER_ADMIN — a leaked JWT_SECRET lets an attacker forge auth tokens for
// any user, a leaked API_CLIENT_SECRET lets them forge signed offerwall
// postbacks, and a leaked DATABASE_URL is full DB access. Match broadly by
// name pattern rather than an exact allowlist, so a newly-added secret is
// redacted by default instead of accidentally exposed.
const SENSITIVE_ENV_KEY_PATTERN = /SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|DATABASE_URL|PRIVATE|CERT/i;

const redactEnvContent = (content: string): string => {
  return content
    .split('\n')
    .map((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return line;
      const key = match[1] || '';
      const value = match[2] || '';
      if (SENSITIVE_ENV_KEY_PATTERN.test(key) && value.trim().length > 0) {
        return `${key}=***REDACTED*** (managed via hosting platform secrets, not editable here)`;
      }
      return line;
    })
    .join('\n');
};

export const getEnvConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) { res.json({ data: '' }); return; }
    const content = fs.readFileSync(envPath, 'utf8');
    res.json({ data: redactEnvContent(content) });
  } catch (error: any) { sendServerError(res, error); }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ data: logs });
  } catch (error: any) { sendServerError(res, error); }
};

export const getLiveUsers = async (req: Request, res: Response) => {
  try {
    // 5 minutes ago
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: { lastActiveAt: { gte: fiveMinsAgo } },
      select: { id: true, name: true, currentScreen: true, lastActiveAt: true }
    });
    res.json({ data: users });
  } catch (error: any) { sendServerError(res, error); }
};

export const getUserIntelligence = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId as string) },
      include: {
        devices: true,
        fraudLogs: true,
        ledgerEntries: { orderBy: { timestamp: 'desc' }, take: 50 },
        referrals: { include: { referred: { select: { id: true, name: true } } } },
        referredBy: { include: { referrer: { select: { id: true, name: true } } } }
      }
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const coins = await getBalance(user.id);
    res.json({ data: { ...user, coins } });
  } catch (error: any) { sendServerError(res, error); }
};

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { lastActiveAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    
    const ledger = await prisma.coinLedger.aggregate({ _sum: { amount: true } });
    
    const totalWithdrawn = await prisma.withdrawal.aggregate({
      _sum: { amountInr: true },
      where: { status: 'APPROVED' }
    });

    const shortsViews = await prisma.shortsSessions.count();
    // Estimate ad revenue based on shorts views (e.g. 0.05 INR per view)
    const estimatedRevenue = shortsViews * 0.05;

    const pendingWithdrawals = await prisma.withdrawal.aggregate({
      _sum: { amountCoins: true },
      where: { status: { in: ['PENDING', 'MANUAL_REVIEW', 'FRAUD_HOLD'] } }
    });

    const streakStats = await prisma.user.aggregate({
      _avg: { streak: true },
      _max: { streak: true },
    });
    const usersWithStreak = await prisma.user.count({ where: { streak: { gt: 0 } } });
    const usersWithStreak7Plus = await prisma.user.count({ where: { streak: { gte: 7 } } });

    res.json({ data: {
      totalUsers, activeUsers,
      totalCoinsCirculating: ledger._sum.amount || 0,
      pendingWithdrawalCoins: pendingWithdrawals._sum.amountCoins || 0,
      totalRevenueINR: estimatedRevenue,
      totalWithdrawnINR: totalWithdrawn._sum.amountInr || 0,
      avgStreak: Number((streakStats._avg.streak || 0).toFixed(1)),
      maxStreak: streakStats._max.streak || 0,
      usersWithStreak,
      usersWithStreak7Plus
    }});
  } catch (error: any) { sendServerError(res, error); }
};

export const getRetentionData = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const d1Users = await prisma.user.count({ where: { createdAt: { lte: oneDayAgo }, lastActiveAt: { gt: oneDayAgo } } });
    const d7Users = await prisma.user.count({ where: { createdAt: { lte: sevenDaysAgo }, lastActiveAt: { gt: sevenDaysAgo } } });
    const d30Users = await prisma.user.count({ where: { createdAt: { lte: thirtyDaysAgo }, lastActiveAt: { gt: thirtyDaysAgo } } });

    const eligibleD1 = await prisma.user.count({ where: { createdAt: { lte: oneDayAgo } } });
    const eligibleD7 = await prisma.user.count({ where: { createdAt: { lte: sevenDaysAgo } } });
    const eligibleD30 = await prisma.user.count({ where: { createdAt: { lte: thirtyDaysAgo } } });

    const countryGroups = await prisma.user.groupBy({
      by: ['country'],
      where: { country: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { country: 'desc' } },
      take: 10,
    });
    const sourceGroups = await prisma.user.groupBy({
      by: ['acquisitionSource'],
      where: { acquisitionSource: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { acquisitionSource: 'desc' } },
      take: 10,
    });

    const totalUsers = await prisma.user.count();

    const byCountry = Object.fromEntries(countryGroups.map(g => [
      g.country || 'Unknown', 
      totalUsers ? Number(((g._count._all / totalUsers) * 100).toFixed(1)) : 0
    ]));
    
    const bySource = Object.fromEntries(sourceGroups.map(g => [
      g.acquisitionSource || 'Unknown', 
      totalUsers ? Number(((g._count._all / totalUsers) * 100).toFixed(1)) : 0
    ]));

    res.json({ data: {
      D1: eligibleD1 ? Number(((d1Users / eligibleD1) * 100).toFixed(1)) : 0,
      D7: eligibleD7 ? Number(((d7Users / eligibleD7) * 100).toFixed(1)) : 0,
      D30: eligibleD30 ? Number(((d30Users / eligibleD30) * 100).toFixed(1)) : 0,
      byCountry,
      bySource
    }});
  } catch (error: any) { sendServerError(res, error); }
};

// A/B Testing
export const getABTests = async (req: Request, res: Response) => {
  try {
    const tests = await prisma.aBTest.findMany({ include: { _count: { select: { allocations: true } } } });
    res.json({ data: tests });
  } catch (error: any) { sendServerError(res, error); }
};

export const createABTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, variants } = req.body;
    if (!name?.trim() || !Array.isArray(variants) || variants.length < 2) {
      res.status(400).json({ error: 'Name and at least two variants are required' });
      return;
    }
    const normalizedVariants = variants.map(variant => String(variant).trim()).filter(Boolean);
    if (normalizedVariants.length < 2 || new Set(normalizedVariants).size !== normalizedVariants.length) {
      res.status(400).json({ error: 'Variants must be non-empty and unique' });
      return;
    }
    const test = await prisma.aBTest.create({
      data: { name: name.trim(), description, variants: JSON.stringify(normalizedVariants) }
    });
    await logAdminAction(req, 'CREATE_AB_TEST', `Created A/B test ${name}`);
    res.json({ data: test });
  } catch (error: any) { sendServerError(res, error); }
};

export const updateABTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { isActive } = req.body;
    const updated = await prisma.aBTest.update({
      where: { id: parseInt(testId as string) },
      data: { isActive }
    });
    await logAdminAction(req, 'UPDATE_AB_TEST', `Updated A/B test ${testId}`);
    res.json({ data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

// Missions
export const getMissions = async (req: Request, res: Response) => {
  try {
    const missions = await prisma.missions.findMany();
    res.json({ data: missions });
  } catch (error: any) { sendServerError(res, error); }
};

export const createMission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, targetCount, rewardXp, rewardCoins, type, tags, metricType, isActive, activeFrom, activeTo, iconEmoji, difficulty } = req.body;
    const mission = await prisma.missions.create({
      data: { 
        title, description, targetCount, rewardXp, rewardCoins, type, 
        tags: tags || [], metricType: metricType || 'CUSTOM', isActive, 
        activeFrom: activeFrom ? new Date(activeFrom) : null, 
        activeTo: activeTo ? new Date(activeTo) : null, 
        iconEmoji, difficulty 
      }
    });
    await logAdminAction(req, 'CREATE_MISSION', `Created mission ${title}`);
    res.json({ data: mission });
  } catch (error: any) { sendServerError(res, error); }
};

export const updateMission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { missionId } = req.params;
    const { title, description, targetCount, rewardXp, rewardCoins, type, tags, metricType, isActive, activeFrom, activeTo, iconEmoji, difficulty } = req.body;
    const dataToUpdate: any = { title, description, targetCount, rewardXp, rewardCoins, type };
    if (tags !== undefined) dataToUpdate.tags = tags;
    if (metricType !== undefined) dataToUpdate.metricType = metricType;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (activeFrom !== undefined) dataToUpdate.activeFrom = activeFrom ? new Date(activeFrom) : null;
    if (activeTo !== undefined) dataToUpdate.activeTo = activeTo ? new Date(activeTo) : null;
    if (iconEmoji !== undefined) dataToUpdate.iconEmoji = iconEmoji;
    if (difficulty !== undefined) dataToUpdate.difficulty = difficulty;
    
    const updated = await prisma.missions.update({
      where: { id: parseInt(missionId as string) },
      data: dataToUpdate
    });
    await logAdminAction(req, 'UPDATE_MISSION', `Updated mission ${missionId}`);
    res.json({ data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

export const deleteMission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { missionId } = req.params;
    await prisma.userMissions.deleteMany({ where: { missionId: parseInt(missionId as string) } });
    await prisma.missions.delete({ where: { id: parseInt(missionId as string) } });
    await logAdminAction(req, 'DELETE_MISSION', `Deleted mission ${missionId}`);
    res.json({ message: 'Mission deleted' });
  } catch (error: any) { sendServerError(res, error); }
};

// Referrals
export const getReferralAdmin = async (req: Request, res: Response) => {
  try {
    // Generate tree format for frontend
    const usersBrought = await prisma.referral.count();
    
    // Top referrer
    const grouped = await prisma.referral.groupBy({
      by: ['referrerId'],
      _count: { referredId: true },
      orderBy: { _count: { referredId: 'desc' } },
      take: 1
    });

    let topReferrerName = 'N/A';
    const topGroup = grouped[0];
    if (topGroup?.referrerId) {
        const topUser = await prisma.user.findUnique({ where: { id: topGroup.referrerId } });
        if (topUser) topReferrerName = topUser.name;
    }

    const referralRows = await prisma.referral.findMany({
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referred: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const referralBonuses = await prisma.coinLedger.aggregate({
      _sum: { amount: true },
      where: { source: { startsWith: 'REFERRAL' } },
    });
    const referredUserIds = referralRows.map(r => r.referredId);
    const withdrawn = referredUserIds.length
      ? await prisma.withdrawal.aggregate({
          _sum: { amountCoins: true, amountInr: true },
          where: { userId: { in: referredUserIds }, status: 'APPROVED' },
        })
      : { _sum: { amountCoins: 0, amountInr: 0 } };

    const tree = referralRows.length
      ? referralRows.map(r => `${r.referrer.name} (#${r.referrer.id}) -> ${r.referred.name} (#${r.referred.id}) | Tier ${r.tier} | ${r.referralCode}`).join('\n')
      : 'No referral data available.';

    res.json({ data: {
      stats: {
        topReferrer: topReferrerName,
        usersBrought,
        referralBonusCoins: referralBonuses._sum.amount || 0,
        totalWithdrawnCoins: withdrawn._sum.amountCoins || 0,
        totalWithdrawnINR: withdrawn._sum.amountInr || 0
      },
      tree
    }});
  } catch (error: any) { sendServerError(res, error); }
};

// Notifications

export const sendNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { target, title, body } = req.body;
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const now = Date.now();
    const cohortFilters: Record<string, any> = {
      ALL: {},
      ALL_USERS: {},
      INACTIVE_3_DAYS: { lastActiveAt: { lt: new Date(now - 3 * 24 * 60 * 60 * 1000) } },
      INACTIVE_7_DAYS: { lastActiveAt: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
      LEVEL_5_PLUS: { level: { gte: 5 } },
    };

    let userIds: number[] = [];
    if (target === 'HIGH_BALANCE') {
      const balances = await prisma.coinLedger.groupBy({
        by: ['userId'],
        _sum: { amount: true },
        having: { amount: { _sum: { gt: 50000 } } },
      });
      userIds = balances.map(row => row.userId);
    } else if (cohortFilters[target] !== undefined) {
      const users = await prisma.user.findMany({ where: cohortFilters[target], select: { id: true } });
      userIds = users.map(user => user.id);
    } else if (/^\d+$/.test(String(target))) {
      userIds = [Number(target)];
    } else {
      res.status(400).json({ error: 'Invalid notification target' });
      return;
    }

    await Promise.allSettled(userIds.map(userId => sendToUser(userId, title.trim(), body.trim(), 'SYSTEM')));

    await logAdminAction(req, 'SEND_NOTIFICATION', `Sent push to ${target}: ${title}`);
    res.json({ message: `Notification processed for ${userIds.length} users.`, recipients: userIds.length });
  } catch (error: any) { sendServerError(res, error); }
};

// Admin-facing view of the same leaderboard the app shows users (see
// getLeaderboard in userController.ts) — lets the team sanity-check top
// earners for fraud signals without needing a personal "your rank" slot.
export const getLeaderboardAdmin = async (req: Request, res: Response) => {
  try {
    const period = req.query.period === 'week' || req.query.period === 'month' ? req.query.period : 'all';

    if (period === 'all') {
      const top = await prisma.user.findMany({
        orderBy: { totalCoinsEarned: 'desc' },
        take: 100,
        select: { id: true, name: true, email: true, totalCoinsEarned: true, level: true, banned: true, shadowBanned: true, trustScore: true, riskScore: true },
      });
      res.json({ data: { period, leaders: top.map((u, i) => ({ rank: i + 1, ...u, coins: u.totalCoinsEarned })) } });
      return;
    }

    const since = new Date();
    if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const grouped = await prisma.coinLedger.groupBy({
      by: ['userId'],
      where: { amount: { gt: 0 }, timestamp: { gte: since }, NOT: { source: { startsWith: 'SHADOW_' } } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, name: true, email: true, level: true, banned: true, shadowBanned: true, trustScore: true, riskScore: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const leaders = grouped
      .filter((g) => userMap.has(g.userId))
      .map((g, i) => ({ rank: i + 1, ...userMap.get(g.userId)!, coins: g._sum.amount || 0 }));

    res.json({ data: { period, leaders } });
  } catch (error: any) { sendServerError(res, error); }
};
