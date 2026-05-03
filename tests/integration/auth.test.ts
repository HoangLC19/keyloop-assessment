import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/shared/db/client';
import { clearAll } from './helpers';

beforeEach(clearAll);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('returns 201 with JWT', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send({ email: 'a@test.com', password: 'password123' });
    const res = await request(app).post('/auth/register').send({ email: 'a@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'b@test.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns JWT for valid credentials', async () => {
    await request(app).post('/auth/register').send({ email: 'b@test.com', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ email: 'b@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    await request(app).post('/auth/register').send({ email: 'b@test.com', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ email: 'b@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('Auth middleware', () => {
  it('returns 401 with no token', async () => {
    expect((await request(app).get('/api/appointments')).status).toBe(401);
  });

  it('returns 403 when CUSTOMER hits /admin route', async () => {
    const { body } = await request(app).post('/auth/register').send({ email: 'c@test.com', password: 'password123' });
    const res = await request(app).get('/admin/dealerships').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(403);
  });
});
