import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

const paramInt = (value: unknown): number => parseInt(String(value ?? ''), 10);

const logAction = async (adminId: number, action: string, details: any) => {
  await prisma.auditLog.create({
    data: { adminId, action, details: JSON.stringify(details) },
  }).catch(() => undefined);
};

const TASK_TYPES = ['INSTALL', 'SURVEY', 'VIDEO', 'SIGNUP', 'REVIEW', 'OTHER'];

const validateNonNegativeInts = (fields: { value: unknown; name: string; min?: number }[]): string | null => {
  for (const { value, name, min = 0 } of fields) {
    if (value === undefined) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
      return `${name} must be an integer >= ${min}`;
    }
  }
  return null;
};

export const getAdminOfferwallTasks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tasks = await prisma.offerwallTask.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { completions: true } } },
    });
    res.json({ data: tasks });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const createOfferwallTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, imageUrl, rewardCoins, type, externalUrl, sortOrder, isActive } = req.body;
    if (!title || !description || rewardCoins === undefined || !type) {
      res.status(400).json({ error: 'title, description, rewardCoins, and type are required' });
      return;
    }
    const validationError = validateNonNegativeInts([
      { value: rewardCoins, name: 'rewardCoins', min: 1 },
      { value: sortOrder, name: 'sortOrder' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const normalizedType = String(type).trim().toUpperCase();
    if (!TASK_TYPES.includes(normalizedType)) {
      res.status(400).json({ error: `type must be one of: ${TASK_TYPES.join(', ')}` });
      return;
    }
    const task = await prisma.offerwallTask.create({
      data: {
        title: String(title).trim().slice(0, 200),
        description: String(description).trim().slice(0, 1000),
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        rewardCoins: Number(rewardCoins),
        type: normalizedType,
        externalUrl: externalUrl ? String(externalUrl).trim() : null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        isActive: isActive ?? true,
        updatedBy: req.user.id,
      },
    });
    await logAction(req.user.id, 'CREATE_OFFERWALL_TASK', { id: task.id, title: task.title });
    res.status(201).json({ data: task });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const updateOfferwallTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.offerwallTask.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const validationError = validateNonNegativeInts([
      { value: req.body.rewardCoins, name: 'rewardCoins', min: 1 },
      { value: req.body.sortOrder, name: 'sortOrder' },
    ]);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const data: any = {};
    if (req.body.title !== undefined) data.title = String(req.body.title).trim().slice(0, 200);
    if (req.body.description !== undefined) data.description = String(req.body.description).trim().slice(0, 1000);
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl ? String(req.body.imageUrl).trim() : null;
    if (req.body.rewardCoins !== undefined) data.rewardCoins = Number(req.body.rewardCoins);
    if (req.body.type !== undefined) {
      const normalizedType = String(req.body.type).trim().toUpperCase();
      if (!TASK_TYPES.includes(normalizedType)) {
        res.status(400).json({ error: `type must be one of: ${TASK_TYPES.join(', ')}` });
        return;
      }
      data.type = normalizedType;
    }
    if (req.body.externalUrl !== undefined) data.externalUrl = req.body.externalUrl ? String(req.body.externalUrl).trim() : null;
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
    data.updatedBy = req.user.id;

    const task = await prisma.offerwallTask.update({ where: { id }, data });
    await logAction(req.user.id, 'UPDATE_OFFERWALL_TASK', { id, before, after: task });
    res.json({ data: task });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const deleteOfferwallTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = paramInt(req.params.id);
    const before = await prisma.offerwallTask.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    // Completions reference this task and must survive its deletion as a
    // historical/audit record of coins already paid out — deleting the task
    // itself (not its completion rows) is the same "keep the ledger honest"
    // reasoning CatalogItem uses for its own already-issued codes.
    await prisma.offerwallTask.delete({ where: { id } });
    await logAction(req.user.id, 'DELETE_OFFERWALL_TASK', { id, deleted: before });
    res.json({ message: 'Task deleted' });
  } catch (error: any) {
    sendServerError(res, error);
  }
};

export const getOfferwallCompletions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.query;
    const where: any = {};
    if (typeof taskId === 'string' && taskId.trim()) where.taskId = parseInt(taskId, 10);

    const completions = await prisma.offerwallCompletion.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: 500,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ data: completions });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
