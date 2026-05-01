import crypto from 'crypto';
import { webhooksRepository } from './webhooks.repository';
import { validateWebhookUrl } from '../notifications/webhook.validator';
import { NotFoundError } from '../../shared/errors';

export const webhooksService = {
  async subscribe(userId: string, data: { url: string; events: string[] }) {
    await validateWebhookUrl(data.url);
    const secret = crypto.randomBytes(32).toString('hex');
    return webhooksRepository.create({ userId, url: data.url, secret, events: data.events });
  },

  list: (userId: string) => webhooksRepository.listByUser(userId),

  async unsubscribe(id: string, userId: string) {
    const deleted = await webhooksRepository.deleteByOwner(id, userId);
    if (!deleted) throw new NotFoundError('Webhook subscription not found');
    return deleted;
  },
};
