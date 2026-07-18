import { Router } from 'express';
import { verifyApiSignature } from '../middlewares/signatureMiddleware';
import { addLedgerEntry } from '../services/ledgerService';
import requestIp from 'request-ip';
import prisma from '../config/db';
import { authenticate } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

const router = Router();
const MAX_OFFERWALL_REWARD_PER_CALL = Number(process.env.MAX_OFFERWALL_REWARD_PER_CALL || 5000);

// Demo task data
const DEMO_TASKS = [
  { id: 'demo_1', title: 'Install GameX App', description: 'Install and reach level 3', reward: 150, type: 'INSTALL' },
  { id: 'demo_2', title: 'Complete Survey', description: '5-minute survey on shopping habits', reward: 80, type: 'SURVEY' },
  { id: 'demo_3', title: 'Watch Video', description: 'Watch a 30-second brand video', reward: 30, type: 'VIDEO' },
  { id: 'demo_4', title: 'Sign Up for Service', description: 'Register on FinanceApp', reward: 200, type: 'SIGNUP' },
  { id: 'demo_5', title: 'Play Mobile Game', description: 'Reach level 5 in PuzzleKing', reward: 120, type: 'INSTALL' },
  { id: 'demo_6', title: 'Take Quiz', description: '10-question personality quiz', reward: 60, type: 'SURVEY' },
  { id: 'demo_7', title: 'Subscribe to Newsletter', description: 'Subscribe and confirm email', reward: 50, type: 'SIGNUP' },
  { id: 'demo_8', title: 'Rate an App', description: 'Leave a review on Play Store', reward: 40, type: 'REVIEW' },
];

// GET /api/webhooks/offerwall/tasks — returns tasks (demo or real)
router.get('/tasks', authenticate, async (req, res) => {
  try {
    const demoMode = await prisma.appConfig.findUnique({ where: { key: 'offerwall_demo_mode' } });
    if (demoMode?.value === 'true') {
      return res.json({ data: DEMO_TASKS, demoMode: true });
    }
    // Real offerwall tasks would come from third-party SDK integration
    res.json({ data: [], demoMode: false });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

// POST /api/webhooks/offerwall/complete — complete a demo task
router.post('/complete', authenticate, async (req: any, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.id;
    const clientIp = requestIp.getClientIp(req) || 'unknown';

    const demoMode = await prisma.appConfig.findUnique({ where: { key: 'offerwall_demo_mode' } });
    if (demoMode?.value !== 'true') {
      return res.status(400).json({ error: 'Offerwall not in demo mode' });
    }

    const task = DEMO_TASKS.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await addLedgerEntry(userId, task.reward, 'OFFERWALL_DEMO', clientIp, `demo_${taskId}_${userId}`);
    res.json({ message: 'Task completed', coinsEarned: task.reward });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.json({ message: 'Already completed', coinsEarned: 0 });
    }
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
