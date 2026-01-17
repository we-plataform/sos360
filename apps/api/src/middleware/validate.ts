import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type RequestLocation = 'body' | 'query' | 'params';

export function validate<T extends z.ZodSchema>(schema: T, location: RequestLocation = 'body') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Use safeParseAsync to get detailed error information
      const result = await schema.safeParseAsync(req[location]);
      
      if (!result.success) {
        // Pass the ZodError to error handler
        next(result.error);
        return;
      }
      
      // Replace request data with validated/transformed data
      req[location] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateRequest<
  TBody extends z.ZodSchema = z.ZodNever,
  TQuery extends z.ZodSchema = z.ZodNever,
  TParams extends z.ZodSchema = z.ZodNever,
>(schemas: { body?: TBody; query?: TQuery; params?: TParams }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
