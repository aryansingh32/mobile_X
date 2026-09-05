import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { claimAdReward, claimRouletteSpin, getRouletteConfig, handleAdMobSSV } from '../controllers/rewardsController';

const router = Router();

router.get('/ssv', handleAdMobSSV); // AdMob webhook, no authenticate middleware
router.post('/ad', authenticate, claimAdReward);
router.get('/roulette-config', authenticate, getRouletteConfig);
router.post('/roulette-spin', authenticate, claimRouletteSpin);

export default router;
