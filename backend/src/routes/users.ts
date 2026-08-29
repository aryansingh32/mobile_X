import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { claimDailyBonus, claimDailyMissions, getProfile, syncStreak, getTransactions, trackActivity, getNotifications, markNotificationRead, deleteAccount, getBadges, purchaseStreakFreeze, getLeaderboard } from '../controllers/userController';
import { registerFingerprint } from '../controllers/fingerprintController';
import prisma from '../config/db';
import { sendServerError } from '../utils/errorResponse';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.post('/daily-bonus', authenticate, claimDailyBonus);
router.post('/streak/sync', authenticate, syncStreak);
router.get('/transactions', authenticate, getTransactions);
router.post('/activity', authenticate, trackActivity);
router.get('/notifications', authenticate, getNotifications);
router.put('/notifications/:notificationId/read', authenticate, markNotificationRead);
router.delete('/account', authenticate, deleteAccount);
router.post('/fingerprint', authenticate, registerFingerprint);
router.get('/badges', authenticate, getBadges);
router.post('/streak-freeze/purchase', authenticate, purchaseStreakFreeze);
router.get('/leaderboard', authenticate, getLeaderboard);

// FCM token registration
router.put('/fcm-token', authenticate, async (req: any, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken is required' });
    await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken } });
    res.json({ message: 'FCM token updated' });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

// Daily missions
router.get('/missions/daily', authenticate, async (req: any, res) => {
  try {
    const missions = await prisma.missions.findMany({ where: { type: 'DAILY' } });
    const userMissions = await prisma.userMissions.findMany({
      where: { userId: req.user.id },
      include: { mission: true },
    });
    const result = missions.map(m => {
      const um = userMissions.find(um => um.missionId === m.id);
      return {
        ...m,
        progress: um?.progress || 0,
        completed: !!um?.completedAt,
        completedAt: um?.completedAt,
      };
    });
    res.json({ data: result });
  } catch (error: any) {
    sendServerError(res, error);
  }
});

router.post('/missions/daily/claim', authenticate, claimDailyMissions);

export default router;
