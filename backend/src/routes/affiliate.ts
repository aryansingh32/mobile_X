import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getAffiliateProducts, getAffiliateBanners, trackAffiliateClick } from '../controllers/affiliateController';

const router = Router();

router.get('/products', authenticate, getAffiliateProducts);
router.get('/banners', authenticate, getAffiliateBanners);
router.post('/click', authenticate, trackAffiliateClick);

export default router;
