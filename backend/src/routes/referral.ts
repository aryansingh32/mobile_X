import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getReferralCode, getReferralStats, applyReferral } from '../controllers/referralController';

const router = Router();

router.get('/code', authenticate, getReferralCode);
router.get('/stats', authenticate, getReferralStats);
router.post('/apply', authenticate, applyReferral);

export default router;
