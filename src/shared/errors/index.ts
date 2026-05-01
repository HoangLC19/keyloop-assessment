import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(400, 'VALIDATION_ERROR', message); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(401, 'UNAUTHORIZED', message); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(403, 'FORBIDDEN', message); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(404, 'NOT_FOUND', message); }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(409, 'CONFLICT', message); }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Postgres exclusion_violation (SQLSTATE 23P01) — concurrent double-booking
  if ((err as any)?.code === '23P01') {
    res.status(409).json({ error: 'No resource available for this time slot', code: 'CONFLICT' });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
