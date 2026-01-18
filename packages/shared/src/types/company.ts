import type { Plan, CompanyRole, WorkspaceRole } from './auth';

// ============================================
// COMPANY TYPES
// ============================================

export interface Company {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    settings: Record<string, unknown>;
    billingInfo: BillingInfo;
    createdAt: Date;
    updatedAt: Date;
}

export interface BillingInfo {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: Date;
}

export interface CompanyMember {
    userId: string;
    companyId: string;
    role: CompanyRole;
    createdAt: Date;
    user?: {
        id: string;
        email: string;
        fullName: string;
        avatarUrl?: string;
    };
}

export interface CreateCompanyRequest {
    name: string;
    workspaceName?: string; // Optional, defaults to "Principal"
}

export interface UpdateCompanyRequest {
    name?: string;
    settings?: Record<string, unknown>;
}

export interface InviteToCompanyRequest {
    email: string;
    role: CompanyRole;
    workspaceAccess: WorkspaceAccessItem[];
}

export interface WorkspaceAccessItem {
    workspaceId: string;
    role: WorkspaceRole;
}

// ============================================
// WORKSPACE TYPES
// ============================================

export interface Workspace {
    id: string;
    name: string;
    companyId: string;
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkspaceMember {
    userId: string;
    workspaceId: string;
    role: WorkspaceRole;
    createdAt: Date;
    user?: {
        id: string;
        email: string;
        fullName: string;
        avatarUrl?: string;
    };
}

export interface CreateWorkspaceRequest {
    name: string;
}

export interface UpdateWorkspaceRequest {
    name?: string;
    settings?: Record<string, unknown>;
}

export interface AddWorkspaceMemberRequest {
    userId: string;
    role: WorkspaceRole;
}

export interface UpdateWorkspaceMemberRequest {
    role: WorkspaceRole;
}

// ============================================
// INVITATION TYPES
// ============================================

export interface CompanyInvitation {
    id: string;
    email: string;
    role: CompanyRole;
    token: string;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
    companyId: string;
    workspaceAccess: WorkspaceAccessItem[];
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface AcceptInvitationRequest {
    token: string;
    password?: string; // Required if user doesn't exist
    fullName?: string; // Required if user doesn't exist
}
