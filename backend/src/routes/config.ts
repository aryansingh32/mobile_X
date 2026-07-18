import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getPublicConfig, getRemoteConfig, reportAdEvent } from '../controllers/configController';

const router = Router();

// Public — safe values only (no auth required)
router.get('/', getPublicConfig);

// Authenticated — full consolidated remote config for app
router.get('/remote', authenticate, getRemoteConfig);

// Authenticated — ad funnel event reporting
router.post('/ad-event', authenticate, reportAdEvent);

export default router;
