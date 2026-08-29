import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getMarquee } from '../controllers/marqueeController';

const router = Router();

router.get('/', authenticate, getMarquee);

export default router;
