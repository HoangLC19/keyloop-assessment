import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../shared/db/client';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { ValidationError } from '../../shared/errors';

const router = Router();
router.use(requireAuth, requireRole('CUSTOMER'));

const VehicleBody = z.object({
  make: z.string().min(1), model: z.string().min(1),
  year: z.number().int().min(1900).max(2100), licensePlate: z.string().min(1),
});

router.post('/', async (req: Request, res: Response) => {
  const p = VehicleBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await prisma.vehicle.create({ data: { ...p.data, ownerId: req.user!.id } }));
});

router.get('/', async (req: Request, res: Response) => {
  res.json(await prisma.vehicle.findMany({ where: { ownerId: req.user!.id } }));
});

export default router;
