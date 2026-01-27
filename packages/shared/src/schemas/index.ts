import { z } from 'zod';
import { PLATFORMS, LEAD_STATUSES, COMPANY_ROLES, WORKSPACE_ROLES, USER_ROLES } from '../constants';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  companyName: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
  workspaceName: z.string().min(2, 'Nome do workspace deve ter pelo menos 2 caracteres').optional(),
});

export const selectContextSchema = z.object({
  selectionToken: z.string().min(1, 'Token de seleção é obrigatório'),
  companyId: z.string().min(1, 'ID da empresa é obrigatório'),
  workspaceId: z.string().min(1, 'ID do workspace é obrigatório'),
});

// Company schemas
export const companyRoleSchema = z.enum(COMPANY_ROLES);
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres').max(100),
  workspaceName: z.string().min(2).max(100).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteToCompanySchema = z.object({
  email: z.string().email('Email inválido'),
  role: companyRoleSchema.optional(),
  workspaceAccess: z.array(z.object({
    workspaceId: z.string().min(1),
    role: workspaceRoleSchema,
  })).optional(),
});

// Workspace management schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Nome do workspace deve ter pelo menos 2 caracteres').max(100),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  role: workspaceRoleSchema,
});

export const updateWorkspaceMemberSchema = z.object({
  role: workspaceRoleSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

// Lead schemas
export const platformSchema = z.enum(PLATFORMS);
export const leadStatusSchema = z.enum(LEAD_STATUSES);

// New lead enum schemas
export const leadGenderSchema = z.enum(['male', 'female', 'other', 'unknown']);
export const leadPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const companySizeSchema = z.enum([
  'SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_500',
  'SIZE_501_1000', 'SIZE_1001_5000', 'SIZE_5001_10000', 'SIZE_10001_PLUS'
]);

// Lead address schema
export const leadAddressSchema = z.object({
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  country: z.string().length(2).nullable().optional(), // ISO 2-letter code
});

export const createLeadSchema = z.object({
  platform: platformSchema.optional(),
  username: z.string().max(100).optional(),
  fullName: z.string().max(200).optional(),
  profileUrl: z.string().url().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional(),
  location: z.string().max(200).optional(),
  followersCount: z.number().int().min(0).optional(),
  followingCount: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  // New fields
  gender: leadGenderSchema.optional(),
  priority: leadPrioritySchema.optional(),
  jobTitle: z.string().max(200).optional(),
  companySize: companySizeSchema.optional(),
  address: leadAddressSchema.optional(),
  pipelineStageId: z.string().optional(),
});

export const updateLeadSchema = z.object({
  status: leadStatusSchema.optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  pipelineStageId: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
  // New fields
  gender: leadGenderSchema.optional(),
  priority: leadPrioritySchema.optional(),
  jobTitle: z.string().max(200).optional(),
  companySize: companySizeSchema.optional(),
  address: leadAddressSchema.optional(),
});

// Helper to validate URL, empty string, or null
const urlOrEmpty = z.union([
  z.string().url(),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform((val) => (val === '' || val === null || val === undefined ? null : val));

// More lenient URL validation for avatar URLs (Instagram CDN URLs can be complex)
const avatarUrlOrEmpty = z.union([
  z.string().min(1).refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'Avatar URL must start with http:// or https://'
  }),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform((val) => (val === '' || val === null || val === undefined ? null : val));

// Helper to validate email, empty string, or null
const emailOrEmpty = z.union([
  z.string().email(),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform((val) => (val === '' || val === null || val === undefined ? null : val));

export const importLeadDataSchema = z.object({
  username: z.union([z.string().max(100), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  fullName: z.union([z.string().max(200), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  profileUrl: urlOrEmpty.optional(),
  avatarUrl: avatarUrlOrEmpty.optional(),
  bio: z.union([z.string().max(1000), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  email: emailOrEmpty.optional(),
  phone: z.union([z.string().max(50), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  followersCount: z.union([z.number().int().min(0), z.null(), z.undefined()]).optional(),
  followingCount: z.union([z.number().int().min(0), z.null(), z.undefined()]).optional(),
  postsCount: z.union([z.number().int().min(0), z.null(), z.undefined()]).optional(),
  verified: z.union([z.boolean(), z.null(), z.undefined()]).optional(),
  location: z.union([z.string().max(200), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  website: urlOrEmpty.optional(),
  // LinkedIn-specific fields
  headline: z.union([z.string().max(500), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  company: z.union([z.string().max(200), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  industry: z.union([z.string().max(200), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  connectionCount: z.union([z.number().int().min(0), z.null(), z.undefined()]).optional(),
  // Score and analysis fields (from AI)
  score: z.union([z.number().int().min(0).max(100), z.null(), z.undefined()]).optional(),
  analysisReason: z.union([z.string().max(1000), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  // Enrichment data (LinkedIn deep extraction)
  enrichment: z.any().optional(), // Will be validated by linkedInEnrichmentPayloadSchema when present
  // New fields for expanded lead data
  gender: z.union([leadGenderSchema, z.null(), z.undefined()]).optional(),
  priority: z.union([leadPrioritySchema, z.null(), z.undefined()]).optional(),
  jobTitle: z.union([z.string().max(200), z.literal(''), z.null(), z.undefined()]).transform((val) => (val === '' ? null : val)).optional(),
  companySize: z.union([companySizeSchema, z.null(), z.undefined()]).optional(),
  address: leadAddressSchema.nullable().optional(),
});

export const importLeadsSchema = z.object({
  source: z.enum(['extension', 'csv', 'manual']),
  platform: platformSchema,
  sourceUrl: z.union([
    z.string().url(),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]).transform((val) => (val === '' || val === null || val === undefined ? null : val)).optional(),
  leads: z.array(importLeadDataSchema).min(1).max(1000),
  tags: z.array(z.string()).optional(),
  autoAssign: z.boolean().optional(),
  audienceId: z.string().optional(), // ID da audiência para associar os leads
  pipelineStageId: z.string().optional(), // ID do estágio do pipeline para importar os leads diretamente
});

// Instagram Post data schema
export const instagramPostDataSchema = z.object({
  postUrl: z.string().url(),
  caption: z.string().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  likesCount: z.number().int().min(0).optional(),
  commentsCount: z.number().int().min(0).optional(),
  authorUsername: z.string(),
  authorFullName: z.string().optional(),
  authorAvatarUrl: z.string().url().optional(),
  extractedAt: z.string().optional(),
});

// Import Post schema - for importing post data only (not the lead itself)
export const importPostSchema = z.object({
  platform: z.literal('instagram'),
  postData: instagramPostDataSchema,
  tags: z.array(z.string()).optional(),
  pipelineStageId: z.string().optional(),
});

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

// Conversation schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'document', 'template']).optional(),
});

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  platform: platformSchema.optional(),
  category: z.string().max(100).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(5000).optional(),
  platform: platformSchema.optional().nullable(),
  category: z.string().max(100).optional().nullable(),
});

// User schemas
export const inviteUserSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(USER_ROLES).optional(),
});

export const updateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  fullName: z.string().min(2).max(200).optional(),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Lead filters
export const leadFiltersSchema = paginationSchema.extend({
  platform: platformSchema.optional(),
  status: leadStatusSchema.optional(),
  tags: z.string().optional(),
  assignedTo: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.string().optional(),
  scoreMin: z.coerce.number().int().min(0).max(100).optional(),
  scoreMax: z.coerce.number().int().min(0).max(100).optional(),
});

// Conversation filters
export const conversationFiltersSchema = paginationSchema.extend({
  status: z.enum(['active', 'archived']).optional(),
  unread: z.coerce.boolean().optional(),
  platform: platformSchema.optional(),
  assignedTo: z.string().optional(),
});

// Export leads schema
export const exportLeadsSchema = z.object({
  // Fields to include in export (if not provided, export all available fields)
  fields: z.array(z.string()).optional(),
  // Filtering options
  platform: platformSchema.optional(),
  status: leadStatusSchema.optional(),
  tags: z.string().optional(),
  pipelineStageId: z.string().optional(),
  assignedTo: z.string().optional(),
  search: z.string().max(200).optional(),
  scoreMin: z.coerce.number().int().min(0).max(100).optional(),
  scoreMax: z.coerce.number().int().min(0).max(100).optional(),
  // Date range filtering - accepts both date strings (YYYY-MM-DD) and datetime strings (ISO 8601)
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  // Format specification (currently only CSV supported)
  format: z.enum(['csv']).default('csv'),
});

export * from './automations';
export * from './enrichment';
export * from './posts';
