import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path, method: req.method }, 'Error occurred');

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => {
      const errorObj: Record<string, unknown> = {
        field: e.path.join('.') || 'root',
        message: e.message,
        code: e.code,
      };
      if (e.path.length > 0 && req.body && typeof req.body === 'object') {
        const bodyObj = req.body as Record<string, unknown>;
        errorObj.received = bodyObj[e.path[0]];
      }
      return errorObj;
    });
    
    logger.warn({ errors, body: req.body, path: req.path }, 'Validation failed');
    
    res.status(400).json({
      success: false,
      error: {
        type: 'validation_error',
        title: 'Validation Failed',
        status: 400,
        errors,
      },
    });
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    const errorResponse: Record<string, unknown> = {
      type: err.type,
      title: err.name,
      status: err.statusCode,
      detail: err.message,
    };
    
    // Only add errors if details exists and is an object or array
    if (err.details && (typeof err.details === 'object' || Array.isArray(err.details))) {
      errorResponse.errors = err.details;
    }
    
    res.status(err.statusCode).json({
      success: false,
      error: errorResponse,
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: {
      type: 'internal_error',
      title: 'Internal Server Error',
      status: 500,
      detail: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    },
  });
}
