import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/shared/db/client';
import { clearAll, makeToken } from './helpers';

let customerToken: string;
let customer2Token: string;
let vehicleId: string;
let dealershipId: string;
let serviceTypeId: string;

beforeAll(async () => {
  await clearAll();

  const [c1, c2, dealership, st] = await Promise.all([
    prisma.user.create({ data: { email: 'c1@test.com', passwordHash: 'x', role: 'CUSTOMER' } }),
    prisma.user.create({ data: { email: 'c2@test.com', passwordHash: 'x', role: 'CUSTOMER' } }),
    prisma.dealership.create({ data: { name: 'Test Motors', address: '1 St' } }),
    prisma.serviceType.create({ data: { name: 'oil_change', durationMinutes: 60 } }),
  ]);

  const [, tech, vehicle] = await Promise.all([
    prisma.serviceBay.create({ data: { dealershipId: dealership.id, name: 'Bay 1' } }),
    prisma.technician.create({ data: { dealershipId: dealership.id, name: 'Bob', email: 'bob@shop.com' } }),
    prisma.vehicle.create({ data: { ownerId: c1.id, make: 'Toyota', model: 'Camry', year: 2020, licensePlate: 'ABC-1' } }),
  ]);

  await prisma.technicianCertification.create({ data: { technicianId: tech.id, serviceTypeId: st.id } });

  customerToken = makeToken(c1.id, 'CUSTOMER');
  customer2Token = makeToken(c2.id, 'CUSTOMER');
  vehicleId = vehicle.id;
  dealershipId = dealership.id;
  serviceTypeId = st.id;
});

afterEach(() => prisma.appointment.deleteMany());
afterAll(() => prisma.$disconnect());

const body = () => ({
  vehicleId, dealershipId, serviceTypeId,
  startTime: '2026-06-01T09:00:00Z',
});

describe('POST /api/appointments', () => {
  it('creates CONFIRMED appointment', async () => {
    const res = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('returns 409 for double-booking same slot', async () => {
    await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    const res = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    expect(res.status).toBe(409);
  });

  it('returns 404 when vehicleId belongs to another customer', async () => {
    const res = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customer2Token}`).send(body());
    expect(res.status).toBe(404);
  });
});

describe('Concurrent double-booking', () => {
  it('exactly one of two concurrent requests for the same only-available slot succeeds', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body()),
      request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body()),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});

describe('PATCH /api/appointments/:id/cancel', () => {
  it('cancels own appointment', async () => {
    const { body: appt } = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    const res = await request(app).patch(`/api/appointments/${appt.id}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('returns 404 for another customer appointment', async () => {
    const { body: appt } = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    const res = await request(app).patch(`/api/appointments/${appt.id}/cancel`).set('Authorization', `Bearer ${customer2Token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent appointment', async () => {
    const res = await request(app).patch('/api/appointments/00000000-0000-0000-0000-000000000000/cancel').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/appointments/:id/reschedule', () => {
  it('reschedules to a free slot', async () => {
    const { body: appt } = await request(app).post('/api/appointments').set('Authorization', `Bearer ${customerToken}`).send(body());
    const res = await request(app)
      .patch(`/api/appointments/${appt.id}/reschedule`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ startTime: '2026-06-01T11:00:00Z' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.startTime).toISOString()).toBe('2026-06-01T11:00:00.000Z');
  });
});
