import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/shared/db/client';
import { clearAll, makeToken } from './helpers';
import { webhooksRepository } from '../../src/modules/webhooks/webhooks.repository';

let token: string;

beforeAll(async () => {
  await clearAll();
  const user = await prisma.user.create({ data: { email: 'w@test.com', passwordHash: 'x', role: 'CUSTOMER' } });
  token = makeToken(user.id, 'CUSTOMER');
});

afterAll(() => prisma.$disconnect());

describe('POST /api/webhooks', () => {
  it('rejects HTTP URLs', async () => {
    const res = await request(app).post('/api/webhooks').set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/hook', events: ['appointment.confirmed'] });
    expect(res.status).toBe(400);
  });

  it('rejects localhost URLs', async () => {
    const res = await request(app).post('/api/webhooks').set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://localhost/hook', events: ['appointment.confirmed'] });
    expect(res.status).toBe(400);
  });
});

describe('webhook tenant isolation', () => {
  it('findByEventForUser does not return subscriptions belonging to a different user', async () => {
    await clearAll();
    const userA = await prisma.user.create({ data: { email: 'a@test.com', passwordHash: 'x', role: 'CUSTOMER' } });
    const userB = await prisma.user.create({ data: { email: 'b@test.com', passwordHash: 'x', role: 'CUSTOMER' } });

    await prisma.webhookSubscription.create({
      data: { userId: userB.id, url: 'https://b.example.com/hook', secret: 'sec', events: ['appointment.confirmed'] },
    });

    const subs = await webhooksRepository.findByEventForUser('appointment.confirmed', userA.id);
    expect(subs).toHaveLength(0);
  });
});
