import { Request, Response, NextFunction } from 'express';
import { decodeSession, type JwtPayload } from '../auth/session';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    req.user = decodeSession(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'superadmin') {
    res.status(403).json({ error: 'Superadmin access required' });
    return;
  }
  next();
}

export function requireCompanyScope(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'superadmin') {
    if (typeof req.query.company_id === 'string' && req.query.company_id) {
      next();
      return;
    }
    res.status(400).json({ error: 'company_id query parameter required for superadmin scope' });
    return;
  }

  if (!req.user?.companyId) {
    res.status(400).json({ error: 'Company context required' });
    return;
  }
  next();
}

export function getRequestCompanyId(req: Request): string | null {
  if (req.user?.role === 'superadmin') {
    return typeof req.query.company_id === 'string' ? req.query.company_id : null;
  }
  return req.user?.companyId ?? null;
}

export function getRequestProfessionalId(req: Request): string | null {
  if (req.user?.role === 'professional') {
    return req.user.professionalId ?? null;
  }

  if (typeof req.query.professional_id === 'string' && req.query.professional_id) {
    return req.query.professional_id;
  }

  return null;
}

export function requireProfessionalSession(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'professional' || !req.user.professionalId) {
    res.status(403).json({ error: 'Professional access required' });
    return;
  }
  next();
}
