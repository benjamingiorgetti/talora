import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthUser, Role } from '@talora/shared';

export interface JwtPayload {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  companyId: string | null;
  professionalId?: string | null;
  companyName?: string | null;
  impersonatedBy?: string | null;
  iat?: number;
  exp?: number;
}

export function signSession(user: AuthUser): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      companyId: user.company_id,
      professionalId: user.professional_id ?? null,
      companyName: user.company_name ?? null,
      impersonatedBy: user.impersonated_by ?? null,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function decodeSession(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
