import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
} from './errors.js';

describe('AppError', () => {
  it('should create an error with all properties', () => {
    const error = new AppError(500, 'test_error', 'Test message', { foo: 'bar' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(500);
    expect(error.type).toBe('test_error');
    expect(error.details).toEqual({ foo: 'bar' });
  });

  it('should create an error without details', () => {
    const error = new AppError(500, 'test_error', 'Test message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(500);
    expect(error.type).toBe('test_error');
    expect(error.details).toBeUndefined();
  });

  it('should extend Error correctly', () => {
    const error = new AppError(500, 'test_error', 'Test message');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });
});

describe('ValidationError', () => {
  it('should create a validation error with errors array', () => {
    const errors = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Password too short' },
    ];
    const error = new ValidationError('Validation failed', errors);

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(400);
    expect(error.type).toBe('validation_error');
    expect(error.details).toEqual(errors);
  });

  it('should create a validation error without errors array', () => {
    const error = new ValidationError('Validation failed');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(400);
    expect(error.type).toBe('validation_error');
    expect(error.details).toBeUndefined();
  });
});

describe('UnauthorizedError', () => {
  it('should create an unauthorized error with custom message', () => {
    const error = new UnauthorizedError('Invalid credentials');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(401);
    expect(error.type).toBe('unauthorized');
  });

  it('should create an unauthorized error with default message', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('Não autorizado');
    expect(error.statusCode).toBe(401);
    expect(error.type).toBe('unauthorized');
  });
});

describe('ForbiddenError', () => {
  it('should create a forbidden error with custom message', () => {
    const error = new ForbiddenError('Insufficient permissions');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ForbiddenError');
    expect(error.message).toBe('Insufficient permissions');
    expect(error.statusCode).toBe(403);
    expect(error.type).toBe('forbidden');
  });

  it('should create a forbidden error with default message', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ForbiddenError');
    expect(error.message).toBe('Acesso negado');
    expect(error.statusCode).toBe(403);
    expect(error.type).toBe('forbidden');
  });
});

describe('NotFoundError', () => {
  it('should create a not found error with custom resource name', () => {
    const error = new NotFoundError('User');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('User não encontrado');
    expect(error.statusCode).toBe(404);
    expect(error.type).toBe('not_found');
  });

  it('should create a not found error with default resource name', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Recurso não encontrado');
    expect(error.statusCode).toBe(404);
    expect(error.type).toBe('not_found');
  });
});

describe('ConflictError', () => {
  it('should create a conflict error', () => {
    const error = new ConflictError('Email already exists');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ConflictError');
    expect(error.message).toBe('Email already exists');
    expect(error.statusCode).toBe(409);
    expect(error.type).toBe('conflict');
  });
});

describe('TooManyRequestsError', () => {
  it('should create a rate limit error with custom message', () => {
    const error = new TooManyRequestsError('Rate limit exceeded');

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('TooManyRequestsError');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
    expect(error.type).toBe('rate_limited');
  });

  it('should create a rate limit error with default message', () => {
    const error = new TooManyRequestsError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('TooManyRequestsError');
    expect(error.message).toBe('Muitas requisições. Tente novamente mais tarde.');
    expect(error.statusCode).toBe(429);
    expect(error.type).toBe('rate_limited');
  });
});
