import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@sos360/database';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { JwtPayload, CompanyRole, WorkspaceRole } from '@sos360/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        companyId: string;
        companyRole: CompanyRole;
        workspaceId: string;
        workspaceRole: WorkspaceRole;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT
 * Extracts user, company, and workspace context from the token
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token não fornecido');
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Token inválido ou expirado');
    }

    // Validate that user exists and has access to the company/workspace
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Verify company membership
    const companyMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: payload.sub,
          companyId: payload.companyId,
        },
      },
    });

    if (!companyMember) {
      throw new UnauthorizedError('Usuário não pertence a esta empresa');
    }

    // Verify workspace membership
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: payload.sub,
          workspaceId: payload.workspaceId,
        },
      },
    });

    if (!workspaceMember) {
      throw new UnauthorizedError('Usuário não tem acesso a este workspace');
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: payload.companyId,
      companyRole: companyMember.role as CompanyRole,
      workspaceId: payload.workspaceId,
      workspaceRole: workspaceMember.role as WorkspaceRole,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role hierarchy for workspace permissions
 * Higher number = more permissions
 */
const workspaceRoleHierarchy: Record<WorkspaceRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1,
};

/**
 * Role hierarchy for company permissions
 */
const companyRoleHierarchy: Record<CompanyRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

/**
 * Middleware to check if user has required workspace role
 * Uses role hierarchy - higher roles include permissions of lower roles
 */
export function authorize(...allowedRoles: WorkspaceRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRoleLevel = workspaceRoleHierarchy[req.user.workspaceRole];
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => workspaceRoleHierarchy[r]));

    if (userRoleLevel < minRequiredLevel) {
      return next(new ForbiddenError('Você não tem permissão para acessar este recurso'));
    }

    next();
  };
}

/**
 * Middleware to check if user has required company role
 */
export function authorizeCompany(...allowedRoles: CompanyRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRoleLevel = companyRoleHierarchy[req.user.companyRole];
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => companyRoleHierarchy[r]));

    if (userRoleLevel < minRequiredLevel) {
      return next(new ForbiddenError('Você não tem permissão para gerenciar esta empresa'));
    }

    next();
  };
}
