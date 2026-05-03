import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { appointmentsService } from './appointments.service';
import { ValidationError } from '../../shared/errors';

const router = Router();
router.use(requireAuth, requireRole('CUSTOMER'));

const BookingBody = z.object({
  vehicleId: z.string().uuid(),
  dealershipId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  startTime: z.string().datetime(),
});

const RescheduleBody = z.object({ startTime: z.string().datetime() });

const AvailabilityQuery = z.object({
  dealershipId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// NOTE: /availability must be defined before /:id to avoid being matched as an ID
router.get('/availability', async (req: Request, res: Response) => {
  const p = AvailabilityQuery.safeParse(req.query);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  const slots = await appointmentsService.getAvailableSlots({ ...p.data, date: new Date(p.data.date) });
  res.json({ slots });
});

router.post('/', async (req: Request, res: Response) => {
  const p = BookingBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  const appt = await appointmentsService.createAppointment({ ...p.data, customerId: req.user!.id, startTime: new Date(p.data.startTime) });
  res.status(201).json(appt);
});

router.get('/', async (req: Request, res: Response) => {
  res.json(await appointmentsService.listAppointments(req.user!.id));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(await appointmentsService.getAppointment(req.params.id as string, req.user!.id));
});

router.patch('/:id/cancel', async (req: Request, res: Response) => {
  res.json(await appointmentsService.cancelAppointment(req.params.id as string, req.user!.id));
});

router.patch('/:id/reschedule', async (req: Request, res: Response) => {
  const p = RescheduleBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.json(await appointmentsService.rescheduleAppointment(req.params.id as string, req.user!.id, new Date(p.data.startTime)));
});

export default router;
