// ============================================
// AUTH TYPES - Multi-workspace support
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  workspaceName?: string; // Optional, defaults to "Principal"
}

// Response after login - returns available companies/workspaces
export interface LoginResponse {
  user: AuthUser;
  companies: CompanyWithWorkspaces[];
  selectionToken: string; // Temporary token for context selection
}

// Response after selecting context
export interface SelectContextResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  context: AuthContext;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

// Full authentication context (user + company + workspace)
export interface AuthContext {
  user: AuthUser;
  company: CompanyContext;
  workspace: WorkspaceContext;
}

export interface CompanyContext {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  role: CompanyRole;
}

export interface WorkspaceContext {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface CompanyWithWorkspaces {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  myRole: CompanyRole;
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  myRole: WorkspaceRole;
}

// Enums
export type Plan =
  | "trial"
  | "starter"
  | "professional"
  | "business"
  | "enterprise";
export type CompanyRole = "owner" | "admin" | "member";
export type WorkspaceRole = "owner" | "admin" | "manager" | "agent" | "viewer";

// JWT Payload structure
export interface JwtPayload {
  sub: string; // User ID
  companyId: string;
  workspaceId: string;
  companyRole: CompanyRole;
  workspaceRole: WorkspaceRole;
  iat: number;
  exp: number;
}

// Selection token (short-lived, for context selection)
export interface SelectionTokenPayload {
  sub: string; // User ID
  type: "selection";
  iat: number;
  exp: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SelectContextRequest {
  selectionToken: string;
  companyId: string;
  workspaceId: string;
}

// ============================================
// DEPRECATED - These will be removed after migration
// ============================================

/**
 * @deprecated Use WorkspaceRole instead
 */
export type UserRole = WorkspaceRole;

/**
 * @deprecated Use AuthContext instead
 */
export interface LegacyAuthResponse {
  user: AuthUser & { role: WorkspaceRole; workspaceId: string };
  workspace: { id: string; name: string; plan: Plan };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
