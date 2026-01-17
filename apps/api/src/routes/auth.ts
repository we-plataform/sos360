import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@sos360/database';
import { loginSchema, registerSchema, refreshTokenSchema } from '@sos360/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getTokenExpiresIn } from '../lib/jwt.js';
import { storage } from '../lib/redis.js';
import { UnauthorizedError, ConflictError } from '../lib/errors.js';
import type { UserRole } from '@sos360/shared';

export const authRouter = Router();

// POST /auth/register
authRouter.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password, fullName, workspaceName } = req.body;

      // Check if email exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictError('Email já está em uso');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create workspace and user
      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName,
          users: {
            create: {
              email,
              passwordHash,
              fullName,
              role: 'owner',
            },
          },
        },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      });

      const user = workspace.users[0];

      // Generate tokens
      const accessToken = signAccessToken({
        sub: user.id,
        workspaceId: workspace.id,
        role: user.role as UserRole,
      });
      const refreshToken = signRefreshToken(user.id);

      // Store refresh token
      await storage.set(
        `refresh:${user.id}:${refreshToken.slice(-10)}`,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            workspaceId: workspace.id,
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            plan: workspace.plan,
          },
          accessToken,
          refreshToken,
          expiresIn: getTokenExpiresIn(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/login
authRouter.post('/login', authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = signAccessToken({
      sub: user.id,
      workspaceId: user.workspaceId,
      role: user.role as UserRole,
    });
    const refreshToken = signRefreshToken(user.id);

    // Store refresh token
    await storage.set(
      `refresh:${user.id}:${refreshToken.slice(-10)}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          workspaceId: user.workspaceId,
          avatarUrl: user.avatarUrl,
        },
        workspace: user.workspace,
        accessToken,
        refreshToken,
        expiresIn: getTokenExpiresIn(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
authRouter.post('/refresh', validate(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido');
    }

    // Check if token exists in storage
    const storedToken = await storage.get(`refresh:${payload.sub}:${refreshToken.slice(-10)}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        workspaceId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Generate new access token
    const accessToken = signAccessToken({
      sub: user.id,
      workspaceId: user.workspaceId,
      role: user.role as UserRole,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: getTokenExpiresIn(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user!.id;

    if (refreshToken) {
      await storage.del(`refresh:${userId}:${refreshToken.slice(-10)}`);
    }

    res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        workspace: {
          select: {
            id: true,
            name: true,
            plan: true,
            settings: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});
