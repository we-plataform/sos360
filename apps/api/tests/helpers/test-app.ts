import express, { type Express } from 'express';
import type { Router } from 'express';
import { vi } from 'vitest';
import request from 'supertest';

/**
 * Creates a test Express app with common middleware setup
 *
 * @param router - Optional router to mount at /api/v1
 * @param options - Optional configuration
 * @returns Configured Express app and supertest request function
 *
 * @example
 * ```ts
 * const { app, request } = createTestApp(scoringRouter);
 * await request(app).get('/api/v1/test').expect(200);
 * ```
 */
export function createTestApp(
  router?: Router,
  options?: {
    middleware?: Array<(req: express.Request, res: express.Response, next: express.NextFunction) => void>;
  }
): { app: Express; request: typeof request } {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Add custom middleware if provided
  if (options?.middleware) {
    options.middleware.forEach((mw) => app.use(mw));
  }

  // Mount router if provided
  if (router) {
    app.use('/api/v1', router);
  }

  return { app, request };
}

/**
 * Creates a test Express app with authentication middleware mocked
 *
 * @param router - Router to mount at /api/v1
 * @param mockUser - Mock user object (uses default if not provided)
 * @returns Configured Express app and supertest request function
 *
 * @example
 * ```ts
 * const { app, request } = createTestAppWithAuth(leadsRouter);
 * await request(app).get('/api/v1/leads').expect(200);
 * ```
 */
export function createTestAppWithAuth(
  router: Router,
  mockUser?: {
    id: string;
    email: string;
    fullName: string;
    companyId: string;
    companyRole: 'owner' | 'admin' | 'member';
    workspaceId: string;
    workspaceRole: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
  }
): { app: Express; request: typeof request } {
  const defaultUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    companyId: 'company-123',
    companyRole: 'owner' as const,
    workspaceId: 'workspace-123',
    workspaceRole: 'admin' as const,
  };

  const user = mockUser || defaultUser;

  const authMiddleware = (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    _req.user = user;
    next();
  };

  return createTestApp(router, { middleware: [authMiddleware] });
}

/**
 * Creates a mock authenticate middleware for testing
 *
 * @param mockUser - Optional mock user object
 * @returns Mock authenticate function
 *
 * @example
 * ```ts
 * vi.mock('../middleware/auth.js', () => ({
 *   authenticate: createMockAuthenticate(),
 *   authorize: createMockAuthorize(),
 * }));
 * ```
 */
export function createMockAuthenticate(mockUser?: {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  companyRole: 'owner' | 'admin' | 'member';
  workspaceId: string;
  workspaceRole: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
}) {
  const defaultUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    companyId: 'company-123',
    companyRole: 'owner' as const,
    workspaceId: 'workspace-123',
    workspaceRole: 'admin' as const,
  };

  const user = mockUser || defaultUser;

  return (_req: any, _res: any, next: any) => {
    _req.user = user;
    next();
  };
}

/**
 * Creates a mock authorize middleware for testing
 *
 * @param allowedRoles - Roles that are authorized (defaults to all)
 * @returns Mock authorize function
 *
 * @example
 * ```ts
 * vi.mock('../middleware/auth.js', () => ({
 *   authenticate: createMockAuthenticate(),
 *   authorize: createMockAuthorize('admin', 'manager'),
 * }));
 * ```
 */
export function createMockAuthorize(..._allowedRoles: string[]) {
  return (_req: any, _res: any, next: any) => next();
}

/**
 * Creates a mock authorizeCompany middleware for testing
 *
 * @param allowedRoles - Roles that are authorized (defaults to all)
 * @returns Mock authorizeCompany function
 */
export function createMockAuthorizeCompany(..._allowedRoles: string[]) {
  return (_req: any, _res: any, next: any) => next();
}
