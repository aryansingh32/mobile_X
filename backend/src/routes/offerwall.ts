import { Router } from 'express';
import { verifyApiSignature } from '../middlewares/signatureMiddleware';
import { addLedgerEntry } from '../services/ledgerService';
import requestIp from 'request-ip';
import prisma from '../config/db';
import { authenticate } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

const router = Router();
const MAX_OFFERWALL_REWARD_PER_CALL = Number(process.env.MAX_OFFERWALL_REWARD_PER_CALL || 5000);

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

// POST /api/webhooks/offerwall/postback — real offerwall webhook
router.post('/postback', verifyApiSignature, async (req, res) => {
  try {
    const { userId, amount, transactionId } = req.body;
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
