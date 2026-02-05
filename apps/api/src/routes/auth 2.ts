import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@lia360/database';
import { loginSchema, registerSchema, selectContextSchema } from '@lia360/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import {
  signAccessToken,
  signRefreshToken,
  signSelectionToken,
  verifyRefreshToken,
  verifySelectionToken,
  getTokenExpiresIn,
  getRefreshTokenTTL,
} from '../lib/jwt.js';
import { storage } from '../lib/redis.js';
import { UnauthorizedError, ConflictError, ForbiddenError } from '../lib/errors.js';
import type { CompanyRole, WorkspaceRole } from '@lia360/shared';

export const authRouter = Router();

/**
 * POST /auth/register
 * Creates a new user with a new company and default workspace
 */
authRouter.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password, fullName, companyName, workspaceName } = req.body;

      // Check if email exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictError('Email já está em uso');
      }

      // Generate slug from company name
      const baseSlug = companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if slug exists and append number if needed
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.company.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create company, workspace, user, and memberships in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create company
        const company = await tx.company.create({
          data: {
            name: companyName,
            slug,
          },
        });

        // Create default workspace
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName || 'Principal',
            companyId: company.id,
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName,
          },
        });

        // Add user as company owner
        await tx.companyMember.create({
          data: {
            userId: user.id,
            companyId: company.id,
            role: 'owner',
          },
        });

        // Add user as workspace owner
        await tx.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: 'owner',
          },
        });

        return { company, workspace, user };
      });

      const { company, workspace, user } = result;

      // Generate tokens
      const accessToken = signAccessToken({
        sub: user.id,
        companyId: company.id,
        workspaceId: workspace.id,
        companyRole: 'owner',
        workspaceRole: 'owner',
      });
      const refreshToken = signRefreshToken(user.id);

      // Store refresh token
      await storage.set(
        `refresh:${user.id}:${refreshToken.slice(-10)}`,
        refreshToken,
        'EX',
        getRefreshTokenTTL()
      );

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: getRefreshTokenTTL() * 1000, // Convert to milliseconds
        path: '/',
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
          },
          context: {
            company: {
              id: company.id,
              name: company.name,
              slug: company.slug,
              plan: company.plan,
              role: 'owner',
            },
            workspace: {
              id: workspace.id,
              name: workspace.name,
              role: 'owner',
            },
          },
          accessToken,
          expiresIn: getTokenExpiresIn(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/login
 * Validates credentials and returns available companies/workspaces
 */
authRouter.post('/login', authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
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

    // Get all companies and workspaces the user has access to
    const companyMemberships = await prisma.companyMember.findMany({
      where: { userId: user.id },
      include: {
        company: {
          include: {
            workspaces: {
              include: {
                members: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    const companies = companyMemberships.map((cm) => ({
      id: cm.company.id,
      name: cm.company.name,
      slug: cm.company.slug,
      plan: cm.company.plan,
      myRole: cm.role as CompanyRole,
      workspaces: cm.company.workspaces
        .filter((w) => w.members.length > 0)
        .map((w) => ({
          id: w.id,
          name: w.name,
          myRole: w.members[0].role as WorkspaceRole,
        })),
    }));

    // If user has only one company with one workspace, auto-select
    if (companies.length === 1 && companies[0].workspaces.length === 1) {
      const company = companies[0];
      const workspace = company.workspaces[0];

      const accessToken = signAccessToken({
        sub: user.id,
        companyId: company.id,
        workspaceId: workspace.id,
        companyRole: company.myRole,
        workspaceRole: workspace.myRole,
      });
      const refreshToken = signRefreshToken(user.id);

      // Store refresh token
      await storage.set(
        `refresh:${user.id}:${refreshToken.slice(-10)}`,
        refreshToken,
        'EX',
        getRefreshTokenTTL()
      );

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: getRefreshTokenTTL() * 1000, // Convert to milliseconds
        path: '/',
      });

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
          },
          context: {
            company: {
              id: company.id,
              name: company.name,
              slug: company.slug,
              plan: company.plan,
              role: company.myRole,
            },
            workspace: {
              id: workspace.id,
              name: workspace.name,
              role: workspace.myRole,
            },
          },
          accessToken,
          expiresIn: getTokenExpiresIn(),
          // No selectionRequired since we auto-selected
        },
      });
    }

    // Multiple options - require selection
    const selectionToken = signSelectionToken(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
        },
        companies,
        selectionToken,
        selectionRequired: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/select-context
 * Selects a company and workspace after login
 */
authRouter.post('/select-context', validate(selectContextSchema), async (req, res, next) => {
  try {
    const { selectionToken, companyId, workspaceId } = req.body;

    // Verify selection token
    let tokenPayload;
    try {
      tokenPayload = verifySelectionToken(selectionToken);
    } catch {
      throw new UnauthorizedError('Token de seleção inválido ou expirado');
    }

    const userId = tokenPayload.sub;

    // Verify company membership
    const companyMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
      include: {
        company: true,
      },
    });

    if (!companyMember) {
      throw new ForbiddenError('Você não tem acesso a esta empresa');
    }

    // Verify workspace membership
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      include: {
        workspace: true,
      },
    });

    if (!workspaceMember) {
      throw new ForbiddenError('Você não tem acesso a este workspace');
    }

    // Verify workspace belongs to the company
    if (workspaceMember.workspace.companyId !== companyId) {
      throw new ForbiddenError('Workspace não pertence a esta empresa');
    }

    // Generate tokens
    const accessToken = signAccessToken({
      sub: userId,
      companyId,
      workspaceId,
      companyRole: companyMember.role as CompanyRole,
      workspaceRole: workspaceMember.role as WorkspaceRole,
    });
    const refreshToken = signRefreshToken(userId);

    // Store refresh token
    await storage.set(
      `refresh:${userId}:${refreshToken.slice(-10)}`,
      refreshToken,
      'EX',
      getRefreshTokenTTL()
    );

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: getRefreshTokenTTL() * 1000, // Convert to milliseconds
      path: '/',
    });

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    });

    res.json({
      success: true,
      data: {
        user,
        context: {
          company: {
            id: companyMember.company.id,
            name: companyMember.company.name,
            slug: companyMember.company.slug,
            plan: companyMember.company.plan,
            role: companyMember.role,
          },
          workspace: {
            id: workspaceMember.workspace.id,
            name: workspaceMember.workspace.name,
            role: workspaceMember.role,
          },
        },
        accessToken,
        expiresIn: getTokenExpiresIn(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refreshes the access token using httpOnly cookie
 */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token não fornecido');
    }

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

    // Get user with their first company/workspace for context
    // Client should call /auth/switch-context if they want a different workspace
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        companies: {
          include: {
            company: {
              include: {
                workspaces: {
                  include: {
                    members: {
                      where: { userId: payload.sub },
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!user || user.companies.length === 0) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    const companyMember = user.companies[0];
    const workspace = companyMember.company.workspaces.find((w) => w.members.length > 0);

    if (!workspace) {
      throw new UnauthorizedError('Usuário não tem acesso a nenhum workspace');
    }

    // Generate new access token
    const accessToken = signAccessToken({
      sub: user.id,
      companyId: companyMember.companyId,
      workspaceId: workspace.id,
      companyRole: companyMember.role as CompanyRole,
      workspaceRole: workspace.members[0].role as WorkspaceRole,
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

/**
 * POST /auth/logout
 * Invalidates the refresh token and clears httpOnly cookie
 */
authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies.refreshToken;
    const userId = req.user!.id;

    // Remove from Redis if token exists
    if (refreshToken) {
      await storage.del(`refresh:${userId}:${refreshToken.slice(-10)}`);
    }

    // Clear the httpOnly cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Returns current user with full context
 */
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    // Get current company
    const companyMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: req.user!.id,
          companyId: req.user!.companyId,
        },
      },
      include: {
        company: true,
      },
    });

    // Get current workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user!.id,
          workspaceId: req.user!.workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    // Get all companies/workspaces for switching
    const allCompanies = await prisma.companyMember.findMany({
      where: { userId: req.user!.id },
      include: {
        company: {
          include: {
            workspaces: {
              include: {
                members: {
                  where: { userId: req.user!.id },
                },
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          ...user,
        },
        context: {
          company: companyMember
            ? {
              id: companyMember.company.id,
              name: companyMember.company.name,
              slug: companyMember.company.slug,
              plan: companyMember.company.plan,
              role: companyMember.role,
            }
            : null,
          workspace: workspaceMember
            ? {
              id: workspaceMember.workspace.id,
              name: workspaceMember.workspace.name,
              role: workspaceMember.role,
            }
            : null,
        },
        companies: allCompanies.map((cm) => ({
          id: cm.company.id,
          name: cm.company.name,
          slug: cm.company.slug,
          plan: cm.company.plan,
          myRole: cm.role,
          workspaces: cm.company.workspaces
            .filter((w) => w.members.length > 0)
            .map((w) => ({
              id: w.id,
              name: w.name,
              myRole: w.members[0].role,
            })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/switch-context
 * Switches to a different company/workspace (requires valid access token)
 */
authRouter.post('/switch-context', authenticate, async (req, res, next) => {
  try {
    const { companyId, workspaceId } = req.body;
    const userId = req.user!.id;

    // Verify company membership
    const companyMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
      include: {
        company: true,
      },
    });

    if (!companyMember) {
      throw new ForbiddenError('Você não tem acesso a esta empresa');
    }

    // Verify workspace membership
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      include: {
        workspace: true,
      },
    });

    if (!workspaceMember) {
      throw new ForbiddenError('Você não tem acesso a este workspace');
    }

    // Verify workspace belongs to the company
    if (workspaceMember.workspace.companyId !== companyId) {
      throw new ForbiddenError('Workspace não pertence a esta empresa');
    }

    // Generate new access token with new context
    const accessToken = signAccessToken({
      sub: userId,
      companyId,
      workspaceId,
      companyRole: companyMember.role as CompanyRole,
      workspaceRole: workspaceMember.role as WorkspaceRole,
    });

    res.json({
      success: true,
      data: {
        context: {
          company: {
            id: companyMember.company.id,
            name: companyMember.company.name,
            slug: companyMember.company.slug,
            plan: companyMember.company.plan,
            role: companyMember.role,
          },
          workspace: {
            id: workspaceMember.workspace.id,
            name: workspaceMember.workspace.name,
            role: workspaceMember.role,
          },
        },
        accessToken,
        expiresIn: getTokenExpiresIn(),
      },
    });
  } catch (error) {
    next(error);
  }
});
