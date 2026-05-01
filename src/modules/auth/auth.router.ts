import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../shared/db/client';
import { hashPassword, verifyPassword, signToken } from './auth.service';
import { ValidationError, UnauthorizedError, ConflictError } from '../../shared/errors';

const router = Router();

const RegisterBody = z.object({ email: z.string().email(), password: z.string().min(8) });
const LoginBody = z.object({ email: z.string().email(), password: z.string() });

router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
    throw new ConflictError('Email already registered');
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({ data: { email: parsed.data.email, passwordHash, role: 'CUSTOMER' } });
  const token = signToken({ id: user.id, role: user.role });
  res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid credentials');
  }
  res.json({ token: signToken({ id: user.id, role: user.role }), user: { id: user.id, email: user.email, role: user.role } });
});

export default router;
