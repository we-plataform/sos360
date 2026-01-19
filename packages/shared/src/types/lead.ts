export type Platform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'whatsapp'
  | 'telegram'
  | 'discord'
  | 'reddit'
  | 'skool'
  | 'slack'
  | 'pinterest'
  | 'youtube'
  | 'nextdoor'
  | 'gohighlevel'
  | 'other';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'responded'
  | 'qualified'
  | 'scheduled'
  | 'closed'
  | 'lost';

export interface SocialProfile {
  id: string;
  platform: Platform;
  username?: string;
  profileUrl: string;
  avatarUrl?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  verified: boolean;
  leadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  // platform: Platform; // Deprecated - moved to socialProfiles
  // username?: string; // Deprecated - moved to socialProfiles
  // profileUrl?: string; // Deprecated - moved to socialProfiles
  // avatarUrl?: string; // Deprecated - moved to socialProfiles
  // bio?: string; // Deprecated - moved to socialProfiles
  // ... other deprecated fields kept for backward compatibility if needed, or we just rely on optional ?
  platform?: Platform;
  username?: string;
  fullName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  verified: boolean;
  score: number;
  status: LeadStatus;
  notes?: string;
  sourceUrl?: string;
  customFields: Record<string, unknown>;
  lastInteractionAt?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  tags?: Tag[];
  socialProfiles?: SocialProfile[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CreateLeadRequest {
  platform: Platform;
  username?: string;
  fullName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  followersCount?: number;
  followingCount?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateLeadRequest {
  status?: LeadStatus;
  score?: number;
  notes?: string;
  email?: string;
  phone?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportLeadsRequest {
  source: 'extension' | 'csv' | 'manual';
  platform: Platform;
  sourceUrl?: string;
  leads: ImportLeadData[];
  tags?: string[];
  autoAssign?: boolean;
}

export interface ImportLeadData {
  username?: string;
  fullName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  phone?: string;
  followersCount?: number;
  followingCount?: number;
  // Additional fields for import
  postsCount?: number;
  verified?: boolean;
  website?: string;
  location?: string;
  score?: number;
  analysisReason?: string;
  // LinkedIn-specific fields
  headline?: string;       // Professional title/position
  company?: string;        // Current company/employer
  industry?: string;       // Industry/sector
  connectionCount?: number; // Number of connections
}

export interface ImportJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalLeads: number;
  message: string;
}

export interface LeadFilters {
  platform?: Platform;
  status?: LeadStatus;
  tags?: string;
  assignedTo?: string;
  search?: string;
  sort?: string;
  scoreMin?: number;
  scoreMax?: number;
}
