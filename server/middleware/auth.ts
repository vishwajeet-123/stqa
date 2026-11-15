import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuditLog, User, type UserRole } from '../models.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'grocerygo-stqa-dev-secret-key-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = verifyToken(token);
    const dbUser = await User.findById(decoded.userId).select('_id email role name').lean();
    if (!dbUser) {
      return res.status(401).json({ error: 'Session invalidated or user not found.' });
    }
    req.user = {
      userId: String(dbUser._id),
      email: dbUser.email,
      role: dbUser.role as UserRole,
      name: dbUser.name,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifyToken(token);
      const dbUser = await User.findById(decoded.userId).select('_id email role name').lean();
      if (dbUser) {
        req.user = {
          userId: String(dbUser._id),
          email: dbUser.email,
          role: dbUser.role as UserRole,
          name: dbUser.name,
        };
      }
    }
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role "${req.user.role}" does not have permission for this resource.`,
      });
    }
    next();
  };
}

export async function recordAuditLog(params: {
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await AuditLog.create({
      actorId: params.actorId || null,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      module: params.module,
      entityType: params.entityType || '',
      entityId: params.entityId || '',
      details: params.details || '',
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}
