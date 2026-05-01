import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { resourcesService } from './resources.service';
import { ValidationError } from '../../shared/errors';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const DealershipBody = z.object({ name: z.string().min(1), address: z.string().min(1) });
const ServiceTypeBody = z.object({ name: z.string().min(1), durationMinutes: z.number().int().positive() });
const ServiceBayBody = z.object({ name: z.string().min(1) });
const TechnicianBody = z.object({ name: z.string().min(1), email: z.string().email() });
const CertificationBody = z.object({ serviceTypeId: z.string().uuid() });

router.post('/dealerships', async (req: Request, res: Response) => {
  const p = DealershipBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await resourcesService.createDealership(p.data));
});

router.get('/dealerships', async (_req: Request, res: Response) => {
  res.json(await resourcesService.listDealerships());
});

router.post('/service-types', async (req: Request, res: Response) => {
  const p = ServiceTypeBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await resourcesService.createServiceType(p.data));
});

router.get('/service-types', async (_req: Request, res: Response) => {
  res.json(await resourcesService.listServiceTypes());
});

router.post('/dealerships/:id/bays', async (req: Request, res: Response) => {
  const p = ServiceBayBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await resourcesService.createServiceBay(req.params.id, p.data));
});

router.post('/dealerships/:id/technicians', async (req: Request, res: Response) => {
  const p = TechnicianBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await resourcesService.createTechnician(req.params.id, p.data));
});

router.post('/technicians/:id/certifications', async (req: Request, res: Response) => {
  const p = CertificationBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  await resourcesService.addCertification(req.params.id, p.data.serviceTypeId);
  res.status(201).json({ technicianId: req.params.id, serviceTypeId: p.data.serviceTypeId });
});

router.delete('/technicians/:id/certifications/:serviceTypeId', async (_req: Request, res: Response) => {
  await resourcesService.removeCertification(_req.params.id, _req.params.serviceTypeId);
  res.status(204).send();
});

export default router;
