// Onboarding persona type
export type OnboardingPersona = 'sales' | 'marketing' | 'management';

// Onboarding status type
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// Onboarding step type
export type OnboardingStepType =
  | 'install_extension'
  | 'create_pipeline'
  | 'capture_lead'
  | 'send_message'
  | 'create_automation'
  | 'create_audience'
  | 'import_leads'
  | 'setup_workspace';

// Database entity types (matching Prisma schema)
export interface OnboardingProgress {
  id: string;
  userId: string;
  persona: OnboardingPersona | null;
  status: OnboardingStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingStep {
  id: string;
  progressId: string;
  stepType: OnboardingStepType;
  isCompleted: boolean;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// API Request types
export interface UpdateOnboardingProgressRequest {
  persona?: OnboardingPersona;
  status?: OnboardingStatus;
}

export interface UpdateOnboardingStepRequest {
  stepType: OnboardingStepType;
  isCompleted: boolean;
  metadata?: Record<string, unknown>;
}

export interface CompleteOnboardingRequest {
  // No body required
}

// API Response types
export interface OnboardingProgressResponse {
  id: string;
  userId: string;
  persona: OnboardingPersona | null;
  status: OnboardingStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: OnboardingStepResponse[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export interface OnboardingStepResponse {
  id: string;
  stepType: OnboardingStepType;
  isCompleted: boolean;
  completedAt: string | null;
  metadata: Record<string, unknown>;
}

// Summary type for quick checks
export interface OnboardingSummary {
  status: OnboardingStatus;
  persona: OnboardingPersona | null;
  isCompleted: boolean;
  completedSteps: OnboardingStepType[];
  pendingSteps: OnboardingStepType[];
  progress: number; // 0-100
}

// Tour guide configuration
export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'next' | 'skip' | 'complete';
}

export interface TourGuideConfig {
  persona: OnboardingPersona;
  steps: TourStep[];
  autoStart?: boolean;
  showProgress?: boolean;
  allowSkip?: boolean;
}

// Tooltip configuration
export interface OnboardingTooltipConfig {
  id: string;
  target: string; // CSS selector
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'manual';
  dismissible: boolean;
  showOnce?: boolean; // Only show once per user
}

// Celebration configuration
export interface CelebrationConfig {
  type: 'confetti' | 'modal' | 'toast';
  title: string;
  message: string;
  milestone: OnboardingStepType | 'onboarding_complete';
  duration?: number; // milliseconds
}
