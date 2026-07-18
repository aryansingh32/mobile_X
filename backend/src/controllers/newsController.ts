import { Request, Response } from 'express';
import { fetchNewsFromDb } from '../services/rssService';
import prisma from '../config/db';
import { sendServerError } from '../utils/errorResponse';

export const getNews = async (req: Request, res: Response) => {
  try {
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string | undefined;
    const source = req.query.source as string | undefined;
    const result = await fetchNewsFromDb(cursor, limit, category, source);
    res.json(result);
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getFilters = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isDiscoverFilter: true, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, imageUrl: true }
    });
    
    const sources = await prisma.rssSource.findMany({
      where: { isDiscoverFilter: true, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, imageUrl: true }
    });
    
    res.json({
      categories,
      sources
    });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getNewsById = async (req: Request, res: Response) => {
  try {
    const article = await prisma.newsArticle.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: { category: true }
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json({ data: article });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
