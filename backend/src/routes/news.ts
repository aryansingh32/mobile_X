import { Router } from 'express';
import { getNews, getNewsById, getFilters } from '../controllers/newsController';

const router = Router();

router.get('/filters', getFilters);
router.get('/', getNews);
router.get('/:id', getNewsById);

export default router;
