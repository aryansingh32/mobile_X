import { Router } from 'express';
import crypto from 'crypto';
import { addLedgerEntry } from '../services/ledgerService';
import requestIp from 'request-ip';
import prisma from '../config/db';
import { authenticate } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

const router = Router();
const MAX_OFFERWALL_REWARD_PER_CALL = Number(process.env.MAX_OFFERWALL_REWARD_PER_CALL || 5000);

// Constant-time string compare — a plain `===` on attacker-influenced input
// leaks how many leading characters matched via response timing.
const secretsMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// GET /api/webhooks/offerwall/tasks — admin-managed task catalog, minus
// whatever this user has already completed (completed tasks disappear from
// the list rather than showing a disabled "done" state, matching how a
// typical offerwall surfaces available offers).
router.get('/tasks', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const completedTaskIds = await prisma.offerwallCompletion.findMany({
      where: { userId },
      select: { taskId: true },
    });
    const completedIds = completedTaskIds
      .map((c) => c.taskId)
      .filter((id): id is number => id !== null);
    const tasks = await prisma.offerwallTask.findMany({
      where: {
        isActive: true,
        id: { notIn: completedIds },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        rewardCoins: true,
        type: true,
        externalUrl: true,
      },
    });
    res.json({ data: tasks });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

// POST /api/webhooks/offerwall/complete — self-attested completion (no
// third-party network is wired in, so this is trust-and-verify-later, same
// model the old demo tasks used). Pays out exactly once per user per task:
// the OfferwallCompletion unique(userId, taskId) constraint and the ledger's
// own idempotency key both independently prevent a double-credit.
router.post('/complete', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const taskId = parseInt(req.body.taskId, 10);
    if (!Number.isInteger(taskId)) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }

    const task = await prisma.offerwallTask.findUnique({ where: { id: taskId } });
    if (!task || !task.isActive) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const clientIp = requestIp.getClientIp(req) || 'unknown';

    try {
      await prisma.$transaction(async (tx) => {
        await tx.offerwallCompletion.create({
          data: { userId, taskId, taskTitle: task.title, rewardCoins: task.rewardCoins },
        });
        await addLedgerEntry(userId, task.rewardCoins, 'OFFERWALL_TASK', clientIp, `task-${taskId}`, undefined, tx);
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Duplicate — either the completion row or the ledger idempotency
        // key already exists (same user, same task).
        res.json({ message: 'Already completed', coinsEarned: 0 });
        return;
      }
      throw e;
    }

    res.json({ message: 'Task completed', coinsEarned: task.rewardCoins });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

// GET/POST /api/webhooks/offerwall/postback — real offerwall network webhook.
//
// This is deliberately NOT behind verifyApiSignature: that scheme signs a
// JSON body with x-api-signature/x-api-timestamp/x-api-nonce headers using
// this app's own API_CLIENT_SECRET, which is a contract between us and our
// own mobile client — no third-party offerwall network can or will ever
// produce it. (index.ts's requireSignature already exempts this exact path
// for that reason; a prior version of this route re-applied the check
// anyway, which meant no real network's postback could ever have succeeded
// here.) Third-party postbacks are authenticated instead the way virtually
// every offerwall network expects: a static secret token embedded in the
// postback URL template you configure in the network's dashboard, checked
// with a constant-time compare below.
//
// Most networks (CPX Research, AdGate Media, OfferToro, Torox, ...) call
// this as a plain server-to-server GET with query-string params, not a POST
// with a JSON body — this accepts both, and reads params from whichever of
// req.query / req.body actually has them.
const OFFERWALL_POSTBACK_SECRET = process.env.OFFERWALL_POSTBACK_SECRET;

router.all('/postback', async (req, res) => {
  try {
    if (!OFFERWALL_POSTBACK_SECRET) {
      // Fail closed: with no secret configured, there is no way to tell a
      // real network callback from anyone else who finds this URL, so
      // reject everything rather than accept unauthenticated reward grants.
      res.status(503).json({ error: 'Offerwall postback is not configured' });
      return;
    }

    const params = { ...req.query, ...req.body } as Record<string, unknown>;
    const suppliedSecret = params.secret ?? params.security_key ?? params.secure_key;
    if (typeof suppliedSecret !== 'string' || !secretsMatch(suppliedSecret, OFFERWALL_POSTBACK_SECRET)) {
      res.status(401).json({ error: 'Invalid or missing postback secret' });
      return;
    }

    const userId = params.userId ?? params.user_id ?? params.subId ?? params.sub_id;
    const amount = params.amount ?? params.payout ?? params.reward;
    const transactionId = params.transactionId ?? params.transaction_id ?? params.txn_id ?? params.click_id;

    const parsedUserId = Number(userId);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0 || parsedAmount > MAX_OFFERWALL_REWARD_PER_CALL) {
      return res.status(400).json({ error: `amount must be a positive integer up to ${MAX_OFFERWALL_REWARD_PER_CALL}` });
    }
    if (!transactionId || typeof transactionId !== 'string') {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    const clientIp = requestIp.getClientIp(req) || 'unknown';
    const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.banned) return res.status(403).json({ error: 'User is banned' });
    await addLedgerEntry(user.id, parsedAmount, 'OFFERWALL_POSTBACK', clientIp, transactionId);
    res.json({ message: 'Offerwall reward processed successfully' });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

export default router;
