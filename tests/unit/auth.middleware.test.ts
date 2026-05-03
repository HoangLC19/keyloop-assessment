import { Request, Response, NextFunction } from 'express';
import * as authService from '../../src/modules/auth/auth.service';
import { requireAuth, requireRole } from '../../src/modules/auth/auth.middleware';
import { UnauthorizedError, ForbiddenError } from '../../src/shared/errors';

const next = jest.fn() as jest.MockedFunction<NextFunction>;
beforeEach(() => { jest.clearAllMocks(); process.env.JWT_SECRET = 'test-secret'; });

describe('requireAuth', () => {
  it('injects user when token is valid', () => {
    jest.spyOn(authService, 'verifyToken').mockReturnValue({ id: 'u1', role: 'CUSTOMER' });
    const req = { headers: { authorization: 'Bearer valid' } } as Request;
    requireAuth(req, {} as Response, next);
    expect(req.user).toEqual({ id: 'u1', role: 'CUSTOMER' });
    expect(next).toHaveBeenCalledWith();
  });

  it('passes UnauthorizedError when no header', () => {
    const req = { headers: {} } as Request;
    requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe('requireRole', () => {
  it('passes ForbiddenError when role mismatches', () => {
    const req = { user: { id: 'u1', role: 'CUSTOMER' } } as Request;
    requireRole('ADMIN')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next() when role matches', () => {
    const req = { user: { id: 'u1', role: 'ADMIN' } } as Request;
    requireRole('ADMIN')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
