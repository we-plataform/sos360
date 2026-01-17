import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@sos360/database';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { JwtPayload, UserRole } from '@sos360/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: UserRole;
        workspaceId: string;
      };
    }
  }
}

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

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        workspaceId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      workspaceId: user.workspaceId,
    };

    next();
  } catch (error) {
    next(error);
  }
}

const roleHierarchy: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1,
};

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRoleLevel = roleHierarchy[req.user.role];
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => roleHierarchy[r]));

    if (userRoleLevel < minRequiredLevel) {
      return next(new ForbiddenError('Você não tem permissão para acessar este recurso'));
    }

    next();
  };
}
