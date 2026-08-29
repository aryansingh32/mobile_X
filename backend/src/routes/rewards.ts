import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { claimShortReward, claimAdReward, claimRouletteSpin, getRouletteConfig, handleAdMobSSV, claimReadReward } from '../controllers/rewardsController';

const router = Router();

router.get('/ssv', handleAdMobSSV); // AdMob webhook, no authenticate middleware
router.post('/shorts', authenticate, claimShortReward);
router.post('/ad', authenticate, claimAdReward);
router.post('/read', authenticate, claimReadReward);
router.get('/roulette-config', authenticate, getRouletteConfig);
router.post('/roulette-spin', authenticate, claimRouletteSpin);

export default router;
