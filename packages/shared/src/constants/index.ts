export const PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'whatsapp',
  'telegram',
  'discord',
  'reddit',
  'skool',
  'slack',
  'pinterest',
  'youtube',
  'nextdoor',
  'gohighlevel',
  'other',
] as const;

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'responded',
  'qualified',
  'scheduled',
  'closed',
  'lost',
] as const;

export const COMPANY_ROLES = ['owner', 'admin', 'member'] as const;
export const WORKSPACE_ROLES = ['owner', 'admin', 'manager', 'agent', 'viewer'] as const;

/**
 * @deprecated Use WORKSPACE_ROLES instead
 */
export const USER_ROLES = WORKSPACE_ROLES;

export const PLANS = ['trial', 'starter', 'professional', 'business', 'enterprise'] as const;

export const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  tiktok: '#000000',
  whatsapp: '#25D366',
  telegram: '#0088cc',
  discord: '#5865F2',
  reddit: '#FF4500',
  skool: '#000000',
  slack: '#4A154B',
  pinterest: '#E60023',
  youtube: '#FF0000',
  nextdoor: '#00B246',
  gohighlevel: '#FF6B35',
  other: '#6B7280',
};

export const STATUS_COLORS: Record<string, string> = {
  new: '#6B7280',
  contacted: '#3B82F6',
  responded: '#10B981',
  qualified: '#F59E0B',
  scheduled: '#8B5CF6',
  closed: '#059669',
  lost: '#EF4444',
};

export const RATE_LIMITS = {
  auth: { max: 10, windowMs: 60000 },
  import: { max: 5, windowMs: 60000 },
  messages: { max: 60, windowMs: 60000 },
  default: { max: 100, windowMs: 60000 },
};

export const JWT_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_EXPIRES_IN = '30d';

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
};
