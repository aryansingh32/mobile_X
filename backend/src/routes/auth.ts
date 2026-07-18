import { Router } from 'express';
import { googleLogin } from '../controllers/authController';
import { authLimiter } from '../middlewares/securityMiddleware';

const router = Router();

router.post('/google', authLimiter, googleLogin);

export default router;
