import { hashPassword, verifyPassword, signToken, verifyToken } from '../../src/modules/auth/auth.service';

describe('AuthService', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });

  it('hashPassword + verifyPassword round-trip', async () => {
    const hash = await hashPassword('secret123');
    await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('signToken + verifyToken round-trip', () => {
    const token = signToken({ id: 'u1', role: 'CUSTOMER' });
    const decoded = verifyToken(token);
    expect(decoded).toEqual({ id: 'u1', role: 'CUSTOMER' });
  });

  it('verifyToken throws UnauthorizedError for garbage token', () => {
    expect(() => verifyToken('bad.token')).toThrow();
  });
});
