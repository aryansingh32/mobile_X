import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { withdrawalLimiter } from '../middlewares/securityMiddleware';
import { getCatalog, requestWithdrawal, getHistory, postSuggestion, getSuggestions, getMyWithdrawals } from '../controllers/walletController';

const router = Router();

router.get('/catalog', getCatalog);
router.post('/withdraw', authenticate, withdrawalLimiter, requestWithdrawal);
router.get('/history', authenticate, getHistory);
router.get('/withdrawals', authenticate, getMyWithdrawals);
router.post('/suggest', authenticate, postSuggestion);
router.get('/suggest', authenticate, getSuggestions);

export default router;
