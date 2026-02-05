import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler } from './error-handler.js';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError
} from '../lib/errors.js';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock request
    mockReq = {
      path: '/test/path',
      method: 'POST',
      body: {},
    };

    // Setup mock response
    jsonMock = vi.fn();
    statusMock = vi.fn(() => mockRes);
    mockRes = {
      status: statusMock,
      json: jsonMock,
      headersSent: false,
    };

    mockNext = vi.fn();

    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  describe('ZodError handling', () => {
    it('should handle ZodError with field-level validation errors', () => {
      const zodIssue: ZodIssue = {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      };

      const zodError = new ZodError([zodIssue]);
      mockReq.body = { email: 123 };

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Failed',
          status: 400,
          errors: [
            {
              field: 'email',
              message: 'Expected string, received number',
              code: 'invalid_type',
              received: 123,
            },
          ],
        },
      });
    });

    it('should handle ZodError with root-level validation errors', () => {
      const zodIssue: ZodIssue = {
        code: 'invalid_type',
        expected: 'object',
        received: 'string',
        path: [],
        message: 'Expected object, received string',
      };

      const zodError = new ZodError([zodIssue]);

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Failed',
          status: 400,
          errors: [
            {
              field: 'root',
              message: 'Expected object, received string',
              code: 'invalid_type',
            },
          ],
        },
      });
    });

    it('should handle ZodError with nested field paths', () => {
      const zodIssue: ZodIssue = {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['user', 'profile', 'name'],
        message: 'Required',
      };

      const zodError = new ZodError([zodIssue]);
      mockReq.body = { user: { profile: {} } };

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Failed',
          status: 400,
          errors: [
            {
              field: 'user.profile.name',
              message: 'Required',
              code: 'invalid_type',
              received: expect.objectContaining({ profile: {} }),
            },
          ],
        },
      });
    });

    it('should handle ZodError with multiple validation errors', () => {
      const zodIssues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['email'],
          message: 'Required',
        },
        {
          code: 'too_small',
          minimum: 6,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['password'],
          message: 'String must contain at least 6 character(s)',
        },
      ];

      const zodError = new ZodError(zodIssues);
      mockReq.body = { email: undefined, password: '123' };

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Failed',
          status: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Required',
            }),
            expect.objectContaining({
              field: 'password',
              message: 'String must contain at least 6 character(s)',
            }),
          ]),
        },
      });
    });
  });

  describe('Prisma error handling', () => {
    it('should handle P2002 unique constraint violation', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        }
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'A record with this value already exists',
        },
      });
    });

    it('should handle P2025 record not found', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
          meta: {},
        }
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: 'Record not found',
        },
      });
    });

    it('should handle generic Prisma errors in production', () => {
      process.env.NODE_ENV = 'production';

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
          meta: {},
        }
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_error',
          title: 'Database Error',
          status: 500,
          detail: 'A database error occurred',
        },
      });
    });

    it('should handle generic Prisma errors in development with message', () => {
      process.env.NODE_ENV = 'development';

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed on the field: `userId`',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
          meta: { field_name: 'userId' },
        }
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_error',
          title: 'Database Error',
          status: 500,
          detail: 'Foreign key constraint failed on the field: `userId`',
        },
      });
    });

    it('should handle PrismaClientInitializationError in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

      const prismaError = new Prisma.PrismaClientInitializationError(
        'Database connection failed',
        '5.0.0',
        'P1001'
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_unavailable',
          title: 'Database Unavailable',
          status: 503,
          detail: 'Unable to connect to the database. Please check server configuration.',
          hint: undefined,
        },
      });
    });

    it('should handle PrismaClientInitializationError in development with hint', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

      const prismaError = new Prisma.PrismaClientInitializationError(
        'Database connection failed',
        '5.0.0',
        'P1001'
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_unavailable',
          title: 'Database Unavailable',
          status: 503,
          detail: 'Unable to connect to the database. Please check server configuration.',
          hint: 'Check if DATABASE_URL is correctly configured and the database is running',
        },
      });
    });

    it('should handle PrismaClientRustPanicError', () => {
      const prismaError = new Prisma.PrismaClientRustPanicError(
        'Rust panic occurred',
        '5.0.0'
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_unavailable',
          title: 'Database Unavailable',
          status: 503,
          detail: 'Database connection failed. Please try again later.',
        },
      });
    });

    it('should handle PrismaClientUnknownRequestError', () => {
      const prismaError = new Prisma.PrismaClientUnknownRequestError(
        'Unknown error occurred',
        { clientVersion: '5.0.0' }
      );

      errorHandler(prismaError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'database_unavailable',
          title: 'Database Unavailable',
          status: 503,
          detail: 'Database connection failed. Please try again later.',
        },
      });
    });
  });

  describe('AppError handling', () => {
    it('should handle generic AppError', () => {
      const appError = new AppError(
        418,
        'teapot',
        "I'm a teapot"
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(418);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'teapot',
          title: 'AppError',
          status: 418,
          detail: "I'm a teapot",
        },
      });
    });

    it('should handle AppError with details object', () => {
      const appError = new AppError(
        400,
        'validation_error',
        'Validation failed',
        { field: 'email', reason: 'invalid format' }
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'AppError',
          status: 400,
          detail: 'Validation failed',
          errors: { field: 'email', reason: 'invalid format' },
        },
      });
    });

    it('should handle AppError with details array', () => {
      const appError = new AppError(
        400,
        'validation_error',
        'Multiple validation errors',
        [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Too short' },
        ]
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'AppError',
          status: 400,
          detail: 'Multiple validation errors',
          errors: [
            { field: 'email', message: 'Invalid email' },
            { field: 'password', message: 'Too short' },
          ],
        },
      });
    });

    it('should handle AppError without details', () => {
      const appError = new AppError(
        500,
        'internal_error',
        'Something went wrong'
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'AppError',
          status: 500,
          detail: 'Something went wrong',
        },
      });
    });

    it('should handle ValidationError', () => {
      const validationError = new ValidationError(
        'Invalid input',
        [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' },
        ]
      );

      errorHandler(validationError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'ValidationError',
          status: 400,
          detail: 'Invalid input',
          errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password too short' },
          ],
        },
      });
    });

    it('should handle UnauthorizedError', () => {
      const unauthorizedError = new UnauthorizedError('Invalid token');

      errorHandler(unauthorizedError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'unauthorized',
          title: 'UnauthorizedError',
          status: 401,
          detail: 'Invalid token',
        },
      });
    });

    it('should handle ForbiddenError', () => {
      const forbiddenError = new ForbiddenError('Insufficient permissions');

      errorHandler(forbiddenError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'forbidden',
          title: 'ForbiddenError',
          status: 403,
          detail: 'Insufficient permissions',
        },
      });
    });

    it('should handle NotFoundError', () => {
      const notFoundError = new NotFoundError('User');

      errorHandler(notFoundError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'not_found',
          title: 'NotFoundError',
          status: 404,
          detail: 'User não encontrado',
        },
      });
    });

    it('should handle ConflictError', () => {
      const conflictError = new ConflictError('Email already exists');

      errorHandler(conflictError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'conflict',
          title: 'ConflictError',
          status: 409,
          detail: 'Email already exists',
        },
      });
    });

    it('should handle TooManyRequestsError', () => {
      const rateLimitError = new TooManyRequestsError('Rate limit exceeded');

      errorHandler(rateLimitError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'rate_limited',
          title: 'TooManyRequestsError',
          status: 429,
          detail: 'Rate limit exceeded',
        },
      });
    });
  });

  describe('Generic error handling', () => {
    it('should handle unknown errors in production', () => {
      process.env.NODE_ENV = 'production';

      const genericError = new Error('Something unexpected happened');

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
        },
      });
    });

    it('should handle unknown errors in development with message', () => {
      process.env.NODE_ENV = 'development';

      const genericError = new Error('Detailed error message for debugging');

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Detailed error message for debugging',
        },
      });
    });

    it('should not send response if headers already sent', () => {
      mockRes.headersSent = true;

      const genericError = new Error('Error after headers sent');

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle errors with undefined request body', () => {
      const zodIssue: ZodIssue = {
        code: 'invalid_type',
        expected: 'object',
        received: 'undefined',
        path: ['data'],
        message: 'Required',
      };

      const zodError = new ZodError([zodIssue]);
      mockReq.body = undefined;

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Failed',
          status: 400,
          errors: [
            {
              field: 'data',
              message: 'Required',
              code: 'invalid_type',
            },
          ],
        },
      });
    });

    it('should handle AppError with null details', () => {
      const appError = new AppError(
        500,
        'internal_error',
        'Error occurred',
        null
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'AppError',
          status: 500,
          detail: 'Error occurred',
        },
      });
    });

    it('should handle AppError with string details (not included in response)', () => {
      const appError = new AppError(
        500,
        'internal_error',
        'Error occurred',
        'string details'
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'AppError',
          status: 500,
          detail: 'Error occurred',
        },
      });
    });

    it('should handle AppError with number details (not included in response)', () => {
      const appError = new AppError(
        500,
        'internal_error',
        'Error occurred',
        42
      );

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'internal_error',
          title: 'AppError',
          status: 500,
          detail: 'Error occurred',
        },
      });
    });
  });
});
