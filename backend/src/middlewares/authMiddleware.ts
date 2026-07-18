import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { getRequiredSecret } from '../config/secrets';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized, no token' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, getRequiredSecret('JWT_SECRET'));
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    
    if (!user) {
      res.status(401).json({ error: 'Unauthorized, user not found' });
      return;
    }

    if (user.banned) {
      res.status(403).json({ error: 'Account has been banned due to policy violations.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized, token failed' });
  }
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const adminRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FRAUD_ANALYST'];
  if (req.user && adminRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden, admin only' });
  }
};

export const authorizeSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === 'SUPER_ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden, super admin only' });
  }
};

const authorizeRoles = (roles: string[], label: string) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user && roles.includes(req.user.role)) {
    next();
    return;
  }
  res.status(403).json({ error: `Forbidden, ${label} only` });
};

export const authorizeFinanceAdmin = authorizeRoles(['SUPER_ADMIN', 'FINANCE_ADMIN'], 'finance admin');
export const authorizeFraudAnalyst = authorizeRoles(['SUPER_ADMIN', 'FRAUD_ANALYST'], 'fraud analyst');
