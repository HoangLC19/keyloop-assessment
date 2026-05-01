import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { UnauthorizedError } from '../../shared/errors';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { id: string; role: Role }): string {
  return jwt.sign(
    { sub: payload.id, role: payload.role },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyToken(token: string): { id: string; role: Role } {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    return { id: decoded.sub as string, role: decoded.role as Role };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
