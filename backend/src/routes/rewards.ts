import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { claimAdReward, handleAdMobSSV } from '../controllers/rewardsController';

const router = Router();

router.get('/ssv', handleAdMobSSV); // AdMob webhook, no authenticate middleware
router.post('/ad', authenticate, claimAdReward);

export default router;
