import { Request, Response } from 'express';
import prisma from '../config/db';
import { sendServerError } from '../utils/errorResponse';

const logAdminAction = async (req: Request, action: string, details: string) => {
  await prisma.auditLog.create({
    data: { action, details, adminId: (req as any).user?.id ?? null },
  });
};

// Mirrors adminRouletteController's pattern — Badges/UserBadges were already
// modeled and already awarded (see services/badgeService.ts), but there was
// no admin surface to define the catalog beyond running scripts/seedBadges.ts
// by hand. conditionType is deliberately free text, not an enum, so an admin
// can introduce a new tracked metric (e.g. "GAMES_PLAYED") the moment
// checkAndAwardBadges() is called with it from a new event, without a schema
// change.
export const getBadgesAdmin = async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badges.findMany({
      orderBy: [{ conditionType: 'asc' }, { conditionValue: 'asc' }],
      include: { _count: { select: { userBadges: true } } },
    });
    res.json({ data: badges });
  } catch (error: any) { sendServerError(res, error); }
};

export const createBadgeAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, conditionType, conditionValue, imageUrl } = req.body;
    if (!name?.trim() || !description?.trim() || !conditionType?.trim()) {
      res.status(400).json({ error: 'name, description, and conditionType are required' });
      return;
    }
    const badge = await prisma.badges.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        conditionType: String(conditionType).trim().toUpperCase(),
        conditionValue: Number(conditionValue) || 0,
        imageUrl: imageUrl || null,
      },
    });
    await logAdminAction(req, 'CREATE_BADGE', `Created badge ${badge.name}`);
    res.json({ data: badge });
  } catch (error: any) { sendServerError(res, error); }
};

export const updateBadgeAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, conditionType, conditionValue, imageUrl } = req.body;
    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (conditionType !== undefined) dataToUpdate.conditionType = String(conditionType).toUpperCase();
    if (conditionValue !== undefined) dataToUpdate.conditionValue = Number(conditionValue);
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;

    const updated = await prisma.badges.update({ where: { id: Number(id) }, data: dataToUpdate });
    await logAdminAction(req, 'UPDATE_BADGE', `Updated badge ${id}`);
    res.json({ data: updated });
  } catch (error: any) { sendServerError(res, error); }
};

export const deleteBadgeAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.userBadges.deleteMany({ where: { badgeId: Number(id) } });
    await prisma.badges.delete({ where: { id: Number(id) } });
    await logAdminAction(req, 'DELETE_BADGE', `Deleted badge ${id}`);
    res.json({ message: 'Badge deleted' });
  } catch (error: any) { sendServerError(res, error); }
};

export const getBadgeAnalytics = async (req: Request, res: Response) => {
  try {
    const recentEarners = await prisma.userBadges.findMany({
      take: 100,
      orderBy: { earnedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        badge: { select: { name: true } },
      },
    });
    const summary = await prisma.userBadges.groupBy({
      by: ['badgeId'],
      _count: { id: true },
    });
    const badges = await prisma.badges.findMany({ select: { id: true, name: true, conditionType: true, conditionValue: true } });
    res.json({ data: { recentEarners, summary, badges } });
  } catch (error: any) { sendServerError(res, error); }
};
