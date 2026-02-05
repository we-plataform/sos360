import * as React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  OnboardingProgress,
  OnboardingSummary,
  OnboardingStep,
  OnboardingStepType,
  OnboardingPersona,
} from '@lia360/shared';
import { api } from '../../lib/api';

// Re-export types for convenience
export type { OnboardingProgress, OnboardingSummary, OnboardingStep, OnboardingStepType, OnboardingPersona };

interface OnboardingState {
  // Progress data
  progress: OnboardingProgress | null;
  summary: OnboardingSummary | null;

  // Tour state
  isTourOpen: boolean;
  currentTourStep: number;
  hasSeenTour: boolean;

  // UI state
  isChecklistOpen: boolean;
  dismissedChecklist: boolean;

  // Actions
  setProgress: (progress: OnboardingProgress, summary: OnboardingSummary) => void;
  setTourOpen: (open: boolean) => void;
  setCurrentTourStep: (step: number) => void;
  setChecklistOpen: (open: boolean) => void;
  dismissChecklist: () => void;
  markTourSeen: () => void;

  // API calls (will be implemented by hook consumers)
  fetchProgress: () => Promise<void>;
  updateProgress: (updates: { persona?: OnboardingPersona; status?: string }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  completeStep: (stepType: OnboardingStepType, metadata?: Record<string, unknown>) => Promise<void>;
  skipOnboarding: () => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  progress: null,
  summary: null,
  isTourOpen: false,
  currentTourStep: 0,
  hasSeenTour: false,
  isChecklistOpen: false,
  dismissedChecklist: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProgress: (progress, summary) =>
        set({ progress, summary }),

      setTourOpen: (open) =>
        set({ isTourOpen: open }),

      setCurrentTourStep: (step) =>
        set({ currentTourStep: step }),

      setChecklistOpen: (open) =>
        set({ isChecklistOpen: open }),

      dismissChecklist: () =>
        set({ dismissedChecklist: true, isChecklistOpen: false }),

      markTourSeen: () =>
        set({ hasSeenTour: true }),

      fetchProgress: async () => {
        try {
          const data = await api.getOnboardingProgress();
          set({
            progress: data.progress as OnboardingProgress,
            summary: data.summary as OnboardingSummary,
          });
        } catch (error) {
          console.error('Failed to fetch onboarding progress:', error);
          // Don't throw - let components handle null state
          set({ progress: null, summary: null });
        }
      },

      updateProgress: async (updates) => {
        try {
          const data = await api.updateOnboardingProgress(updates);
          set({
            progress: data as OnboardingProgress,
          });
          // Re-fetch to get updated summary
          await get().fetchProgress();
        } catch (error) {
          console.error('Failed to update onboarding progress:', error);
          throw error;
        }
      },

      completeOnboarding: async () => {
        try {
          const data = await api.completeOnboarding();
          set({
            progress: data as OnboardingProgress,
            isTourOpen: false,
          });
          // Re-fetch to get updated summary
          await get().fetchProgress();
        } catch (error) {
          console.error('Failed to complete onboarding:', error);
          throw error;
        }
      },

      completeStep: async (stepType, metadata = {}) => {
        try {
          await api.completeOnboardingStep({
            stepType,
            isCompleted: true,
            metadata,
          });
          // Re-fetch progress to get updated state
          await get().fetchProgress();
        } catch (error) {
          console.error('Failed to complete onboarding step:', error);
          throw error;
        }
      },

      skipOnboarding: async () => {
        try {
          await get().updateProgress({ status: 'skipped' });
          set({
            isTourOpen: false,
            isChecklistOpen: false,
          });
        } catch (error) {
          console.error('Failed to skip onboarding:', error);
          throw error;
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hasSeenTour: state.hasSeenTour,
        dismissedChecklist: state.dismissedChecklist,
        currentTourStep: state.currentTourStep,
      }),
    }
  )
);

// Hook for accessing onboarding state with automatic fetching
export function useOnboarding() {
  const {
    progress,
    summary,
    isTourOpen,
    currentTourStep,
    hasSeenTour,
    isChecklistOpen,
    dismissedChecklist,
    fetchProgress,
  } = useOnboardingStore();

  // Fetch progress on mount if authenticated
  React.useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !progress) {
      fetchProgress();
    }
  }, []);

  return {
    // Derived state
    isCompleted: progress?.status === 'completed',
    isInProgress: progress?.status === 'in_progress',
    isNotStarted: progress?.status === 'not_started',
    isSkipped: progress?.status === 'skipped',
    completionPercentage: summary?.completionPercentage ?? 0,

    // All state and actions from store
    ...useOnboardingStore.getState(),
  };
}

// Hook for waiting for hydration in components
export const useOnboardingHydration = () => {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
};
