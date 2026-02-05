import { vi } from 'vitest';
import type { CompanyRole, WorkspaceRole } from '@lia360/shared';

/**
 * Creates a mock Prisma client with all models
 *
 * @returns Mocked Prisma client
 *
 * @example
 * ```ts
 * vi.mock('@lia360/database', () => ({
 *   prisma: createMockPrisma(),
 * }));
 * ```
 */
export function createMockPrisma() {
  return {
    // User models
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    companyMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },

    // Lead management
    lead: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    pipeline: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    stage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },

    // Scoring
    scoringModel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    scoreHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },

    // Automations
    automation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    automationExecution: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },

    // Audiences
    audience: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    audienceMember: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },

    // Conversations
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },

    // Enrichment
    enrichment: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },

    // Auth
    refreshTokens: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },

    // Transaction helpers
    $transaction: vi.fn(),

    // Disconnect
    $disconnect: vi.fn(),
  };
}

/**
 * Creates a mock user object for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock user object
 *
 * @example
 * ```ts
 * const mockUser = createMockUser({
 *   id: 'custom-user-id',
 *   workspaceRole: 'viewer',
 * });
 * ```
 */
export function createMockUser(overrides?: Partial<{
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  companyRole: CompanyRole;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
}>) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    companyId: 'company-123',
    companyRole: 'owner' as CompanyRole,
    workspaceId: 'workspace-123',
    workspaceRole: 'admin' as WorkspaceRole,
    ...overrides,
  };
}

/**
 * Creates a mock lead object for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock lead object
 */
export function createMockLead(overrides?: Partial<any>) {
  return {
    id: 'lead-123',
    name: 'John Doe',
    email: 'john@example.com',
    workspaceId: 'workspace-123',
    pipelineId: 'pipeline-123',
    stageId: 'stage-123',
    score: null,
    status: 'new',
    source: 'linkedin',
    linkedinProfileUrl: 'https://linkedin.com/in/johndoe',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock pipeline object for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock pipeline object
 */
export function createMockPipeline(overrides?: Partial<any>) {
  return {
    id: 'pipeline-123',
    name: 'Sales Pipeline',
    workspaceId: 'workspace-123',
    stages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock stage object for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock stage object
 */
export function createMockStage(overrides?: Partial<any>) {
  return {
    id: 'stage-123',
    name: 'New Leads',
    pipelineId: 'pipeline-123',
    order: 0,
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock scoring model for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock scoring model object
 */
export function createMockScoringModel(overrides?: Partial<any>) {
  return {
    id: 'model-123',
    name: 'Test Model',
    description: null,
    enabled: true,
    pipelineId: 'pipeline-123',
    criteria: {
      jobTitles: { target: ['CEO', 'CTO'], exclude: [], seniority: [] },
      companies: { industries: ['SaaS', 'Technology'], sizes: [], excludeIndustries: [] },
      engagement: { hasRecentPosts: true },
      completeness: { required: ['email'], bonus: ['phone'] },
    },
    weights: {
      jobTitle: 1.0,
      company: 1.0,
      engagement: 0.8,
      completeness: 0.6,
    },
    thresholdHigh: 80,
    thresholdMedium: 50,
    systemPrompt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock scoring result for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock scoring result object
 */
export function createMockScoringResult(overrides?: Partial<any>) {
  return {
    score: 75,
    classification: 'warm' as const,
    reason: 'Lead scores well on most factors',
    factors: {
      jobTitle: { score: 80, reason: 'Good title match' },
      company: { score: 70, reason: 'Decent company match' },
      engagement: { score: 75, reason: 'Good engagement' },
      completeness: { score: 70, reason: 'Most fields present' },
    },
    ...overrides,
  };
}

/**
 * Creates a mock audience for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock audience object
 */
export function createMockAudience(overrides?: Partial<any>) {
  return {
    id: 'audience-123',
    name: 'Target CEOs',
    description: 'CEOs at SaaS companies',
    workspaceId: 'workspace-123',
    rules: {
      jobTitles: { target: ['CEO'], exclude: [] },
      companies: { industries: ['SaaS'], sizes: [], excludeIndustries: [] },
    },
    leadCount: 150,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock automation for testing
 *
 * @param overrides - Optional properties to override
 * @returns Mock automation object
 */
export function createMockAutomation(overrides?: Partial<any>) {
  return {
    id: 'automation-123',
    name: 'Auto-assign leads',
    description: 'Automatically assign new leads to team members',
    workspaceId: 'workspace-123',
    pipelineId: 'pipeline-123',
    enabled: true,
    trigger: {
      type: 'stage_enter',
      stageId: 'stage-123',
    },
    actions: [
      {
        type: 'assign',
        userId: 'user-456',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock error for testing error handling
 *
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @returns Mock error object
 */
export function createMockError(message: string, statusCode: number = 500) {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
}
