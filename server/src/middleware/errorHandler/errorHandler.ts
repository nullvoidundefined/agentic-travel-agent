import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { NextFunction, Request, Response } from 'express';

// Centralized error handler to ensure all uncaught errors are logged once and surfaced with a safe JSON response.
// The full error is only exposed in non-production environments to avoid leaking implementation details.

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    logger.error({ err, reqId: req.id }, 'Request error');
    const body: { error: string; message: string; details?: unknown } = {
      error: err.code,
      message: err.message,
    };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, reqId: req.id }, 'Unhandled error in request handler');

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Internal server error',
  });
}
