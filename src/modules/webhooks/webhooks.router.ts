import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { webhooksService } from './webhooks.service';
import { ValidationError } from '../../shared/errors';

const router = Router();
router.use(requireAuth, requireRole('CUSTOMER'));

const SubscribeBody = z.object({ url: z.string().url(), events: z.array(z.string()).min(1) });

router.post('/', async (req: Request, res: Response) => {
  const p = SubscribeBody.safeParse(req.body);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  res.status(201).json(await webhooksService.subscribe(req.user!.id, p.data));
});

router.get('/', async (req: Request, res: Response) => {
  res.json(await webhooksService.list(req.user!.id));
});

router.delete('/:id', async (req: Request, res: Response) => {
  await webhooksService.unsubscribe(req.params.id as string, req.user!.id);
  res.status(204).send();
});

export default router;
