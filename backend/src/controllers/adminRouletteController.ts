import { Request, Response } from 'express';
import prisma from '../config/db';
import { sendServerError } from '../utils/errorResponse';

const logAdminAction = async (req: Request, action: string, details: string) => {
  await prisma.auditLog.create({
    data: { action, details, adminId: (req as any).user?.id ?? null } 
  });
};

export const getRouletteItems = async (req: Request, res: Response) => {
  try {
    const items = await prisma.rouletteItem.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: items });
  } catch (error: any) { sendServerError(res, error); }
};

export const createRouletteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, color, rewardCoins, probability, sizePortion, popupType, isActive, sortOrder, imageUrl } = req.body;
    const newItem = await prisma.rouletteItem.create({
      data: { 
        label, 
        color, 
        rewardCoins: Number(rewardCoins), 
        probability: Number(probability), 
        sizePortion: Number(sizePortion), 
        popupType, 
        isActive: Boolean(isActive), 
        sortOrder: Number(sortOrder), 
        imageUrl 
      },
    });
    await logAdminAction(req, 'CREATE_ROULETTE_ITEM', `Created roulette item ${label}`);
    res.json({ data: newItem });
  } catch (error: any) { sendServerError(res, error); }
};

export const updateRouletteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { label, color, rewardCoins, probability, sizePortion, popupType, isActive, sortOrder, imageUrl } = req.body;
    
    const dataToUpdate: any = {};
    if (label !== undefined) dataToUpdate.label = label;
    if (color !== undefined) dataToUpdate.color = color;
    if (rewardCoins !== undefined) dataToUpdate.rewardCoins = Number(rewardCoins);
    if (probability !== undefined) dataToUpdate.probability = Number(probability);
    if (sizePortion !== undefined) dataToUpdate.sizePortion = Number(sizePortion);
    if (popupType !== undefined) dataToUpdate.popupType = popupType;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    if (sortOrder !== undefined) dataToUpdate.sortOrder = Number(sortOrder);
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;

    const updated = await prisma.rouletteItem.update({
      where: { id: Number(id) },
      data: dataToUpdate,
    });
    await logAdminAction(req, 'UPDATE_ROULETTE_ITEM', `Updated roulette item ${id}`);
    res.json({ data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

export const deleteRouletteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // We should probably delete history or cascade. 
    // Prisma does not cascade by default unless defined. 
    // Since history requires the item, we'll delete history first.
    await prisma.rouletteSpinHistory.deleteMany({
      where: { rouletteItemId: Number(id) }
    });
    
    await prisma.rouletteItem.delete({
      where: { id: Number(id) },
    });
    await logAdminAction(req, 'DELETE_ROULETTE_ITEM', `Deleted roulette item ${id}`);
    res.json({ message: 'Item deleted' });
  } catch (error: any) { sendServerError(res, error); }
};

export const getRouletteAnalytics = async (req: Request, res: Response) => {
  try {
    const recentSpins = await prisma.rouletteSpinHistory.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
        rouletteItem: { select: { label: true } }
      }
    });

    const summary = await prisma.rouletteSpinHistory.groupBy({
      by: ['rouletteItemId'],
      _count: { id: true },
      _sum: { coinsAwarded: true }
    });
    
    const items = await prisma.rouletteItem.findMany({ select: { id: true, label: true, color: true } });

    res.json({
      data: {
        recentSpins,
        summary,
        items
      }
    });
  } catch (error: any) { sendServerError(res, error); }
};
