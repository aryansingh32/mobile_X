import { Router } from 'express';
import { getShorts, getTrendingShorts, reportWatchTime } from '../controllers/shortsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getShorts);
router.get('/trending', getTrendingShorts);
router.post('/watch', authenticate, reportWatchTime);

export default router;
