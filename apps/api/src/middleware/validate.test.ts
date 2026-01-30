import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { validate, validateRequest } from './validate.js';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('validate', () => {
    it('should validate body and pass to next middleware on success', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      mockReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should validate query params and pass to next middleware on success', async () => {
      const schema = z.object({
        page: z.string().transform(Number),
        limit: z.string().transform(Number),
      });

      mockReq.query = {
        page: '1',
        limit: '10',
      };

      const middleware = validate(schema, 'query');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({
        page: 1,
        limit: 10,
      });
    });

    it('should validate route params and pass to next middleware on success', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validate(schema, 'params');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    it('should transform data during validation', async () => {
      const schema = z.object({
        age: z.string().transform(Number),
        active: z.string().transform(val => val === 'true'),
      });

      mockReq.body = {
        age: '25',
        active: 'true',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        age: 25,
        active: true,
      });
    });

    it('should pass ZodError to next on validation failure', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      mockReq.body = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
      expect((errorArg as ZodError).errors[0].path).toEqual(['email']);
    });

    it('should handle missing required fields', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      mockReq.body = {
        name: 'John Doe',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
      expect((errorArg as ZodError).errors[0].path).toEqual(['email']);
      expect((errorArg as ZodError).errors[0].code).toBe('invalid_type');
    });

    it('should handle multiple validation errors', async () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
        age: z.number().min(18),
      });

      mockReq.body = {
        name: 'Jo',
        email: 'invalid',
        age: 15,
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
      expect((errorArg as ZodError).errors.length).toBeGreaterThan(1);
    });

    it('should strip unknown fields when using strict schema', async () => {
      const schema = z.object({
        name: z.string(),
      }).strict();

      mockReq.body = {
        name: 'John Doe',
        unknownField: 'should be removed',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
    });

    it('should strip unknown fields by default', async () => {
      const schema = z.object({
        name: z.string(),
      });

      mockReq.body = {
        name: 'John Doe',
        extra: 'field',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
      });
    });

    it('should handle unexpected errors during validation', async () => {
      const schema = z.object({
        value: z.string().refine(() => {
          throw new Error('Unexpected error');
        }),
      });

      mockReq.body = {
        value: 'test',
      };

      const middleware = validate(schema, 'body');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(Error);
      expect((errorArg as Error).message).toBe('Unexpected error');
    });

    it('should default to body when location not specified', async () => {
      const schema = z.object({
        name: z.string(),
      });

      mockReq.body = {
        name: 'John Doe',
      };

      const middleware = validate(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
      });
    });
  });

  describe('validateRequest', () => {
    it('should validate body only', async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      mockReq.body = {
        name: 'John Doe',
      };

      const middleware = validateRequest({ body: bodySchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
      });
    });

    it('should validate query only', async () => {
      const querySchema = z.object({
        search: z.string(),
      });

      mockReq.query = {
        search: 'test',
      };

      const middleware = validateRequest({ query: querySchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({
        search: 'test',
      });
    });

    it('should validate params only', async () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validateRequest({ params: paramsSchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    it('should validate all locations together', async () => {
      const bodySchema = z.object({
        name: z.string(),
      });
      const querySchema = z.object({
        page: z.string().transform(Number),
      });
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.body = { name: 'John Doe' };
      mockReq.query = { page: '1' };
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateRequest({
        body: bodySchema,
        query: querySchema,
        params: paramsSchema,
      });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'John Doe' });
      expect(mockReq.query).toEqual({ page: 1 });
      expect(mockReq.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should pass error to next on body validation failure', async () => {
      const bodySchema = z.object({
        email: z.string().email(),
      });

      mockReq.body = {
        email: 'invalid-email',
      };

      const middleware = validateRequest({ body: bodySchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
    });

    it('should pass error to next on query validation failure', async () => {
      const querySchema = z.object({
        page: z.string().regex(/^\d+$/),
      });

      mockReq.query = {
        page: 'not-a-number',
      };

      const middleware = validateRequest({ query: querySchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
    });

    it('should pass error to next on params validation failure', async () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = {
        id: 'not-a-uuid',
      };

      const middleware = validateRequest({ params: paramsSchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
    });

    it('should stop validation on first error when validating multiple locations', async () => {
      const bodySchema = z.object({
        email: z.string().email(),
      });
      const querySchema = z.object({
        page: z.string(),
      });

      mockReq.body = {
        email: 'invalid-email',
      };
      mockReq.query = {
        page: '1',
      };

      const middleware = validateRequest({
        body: bodySchema,
        query: querySchema,
      });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(ZodError);
    });

    it('should handle empty schemas object', async () => {
      const middleware = validateRequest({});
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should transform data in all locations', async () => {
      const bodySchema = z.object({
        age: z.string().transform(Number),
      });
      const querySchema = z.object({
        active: z.string().transform(val => val === 'true'),
      });

      mockReq.body = { age: '25' };
      mockReq.query = { active: 'true' };

      const middleware = validateRequest({
        body: bodySchema,
        query: querySchema,
      });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ age: 25 });
      expect(mockReq.query).toEqual({ active: true });
    });

    it('should handle unexpected errors during validation', async () => {
      const bodySchema = z.object({
        value: z.string().refine(() => {
          throw new Error('Validation error');
        }),
      });

      mockReq.body = {
        value: 'test',
      };

      const middleware = validateRequest({ body: bodySchema });
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const errorArg = vi.mocked(mockNext).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(Error);
      expect((errorArg as Error).message).toBe('Validation error');
    });
  });
});
