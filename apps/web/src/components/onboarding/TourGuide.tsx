'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, X, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TourStep, TourGuideConfig, OnboardingPersona } from '@lia360/shared';

interface TourGuideProps {
  config: TourGuideConfig;
  isOpen: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  onStepChange?: (stepIndex: number) => void;
  className?: string;
}

// Default tour configurations for different personas
const DEFAULT_TOURS: Record<OnboardingPersona, TourStep[]> = {
  sales: [
    {
      id: 'welcome',
      title: 'Welcome to Lia360!',
      content: 'Let us show you around the platform so you can start capturing and managing leads more effectively.',
      target: 'body',
      placement: 'center',
      action: 'next',
    },
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      content: 'This is your command center. See your pipeline overview, recent activity, and quick actions all in one place.',
      target: '[data-tour="dashboard"]',
      placement: 'bottom',
      action: 'next',
    },
    {
      id: 'leads',
      title: 'Lead Management',
      content: 'View and manage all your leads here. Filter, sort, and take action on your prospects.',
      target: '[data-tour="leads"]',
      placement: 'right',
      action: 'next',
    },
    {
      id: 'pipelines',
      title: 'Sales Pipelines',
      content: 'Create and manage your sales pipelines. Track leads as they move through your sales process.',
      target: '[data-tour="pipelines"]',
      placement: 'left',
      action: 'next',
    },
    {
      id: 'extension',
      title: 'Browser Extension',
      content: 'Install our Chrome extension to capture leads directly from LinkedIn and any website.',
      target: '[data-tour="extension"]',
      placement: 'bottom',
      action: 'complete',
    },
  ],
  marketing: [
    {
      id: 'welcome',
      title: 'Welcome to Lia360!',
      content: 'Discover how to automate your lead capture and nurturing workflows.',
      target: 'body',
      placement: 'center',
      action: 'next',
    },
    {
      id: 'audiences',
      title: 'Audience Management',
      content: 'Create and manage audience segments for targeted campaigns and automation.',
      target: '[data-tour="audiences"]',
      placement: 'right',
      action: 'next',
    },
    {
      id: 'automations',
      title: 'Automation Rules',
      content: 'Set up powerful automation to nurture leads and save time on repetitive tasks.',
      target: '[data-tour="automations"]',
      placement: 'left',
      action: 'next',
    },
    {
      id: 'campaigns',
      title: 'Campaign Management',
      content: 'Track and manage your marketing campaigns with detailed analytics.',
      target: '[data-tour="campaigns"]',
      placement: 'bottom',
      action: 'complete',
    },
  ],
  management: [
    {
      id: 'welcome',
      title: 'Welcome to Lia360!',
      content: 'Get an overview of your team\'s performance and lead management operations.',
      target: 'body',
      placement: 'center',
      action: 'next',
    },
    {
      id: 'team-dashboard',
      title: 'Team Performance',
      content: 'Monitor your team\'s activity, pipeline health, and conversion metrics.',
      target: '[data-tour="team-dashboard"]',
      placement: 'bottom',
      action: 'next',
    },
    {
      id: 'reports',
      title: 'Analytics & Reports',
      content: 'Access detailed reports and insights to make data-driven decisions.',
      target: '[data-tour="reports"]',
      placement: 'left',
      action: 'next',
    },
    {
      id: 'settings',
      title: 'Workspace Settings',
      content: 'Configure your workspace, manage team members, and customize your workflows.',
      target: '[data-tour="settings"]',
      placement: 'right',
      action: 'complete',
    },
  ],
};

export function TourGuide({
  config,
  isOpen,
  onClose,
  onComplete,
  onStepChange,
  className,
}: TourGuideProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);

  // Use provided steps or default based on persona
  const steps = config.steps || DEFAULT_TOURS[config.persona] || DEFAULT_TOURS.sales;
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  React.useEffect(() => {
    // Highlight target element
    if (isOpen && currentStep?.target && currentStep.target !== 'body') {
      const targetElement = document.querySelector(currentStep.target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        return () => {
          targetElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        };
      }
    }
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange?.(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onStepChange?.(prevIndex);
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  const handleSkip = () => {
    onClose?.();
  };

  if (!currentStep) return null;

  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <>
      {/* Highlight overlay for target element */}
      {isOpen && currentStep.target && currentStep.target !== 'body' && (
        <div
          className="fixed inset-0 z-40 bg-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className={cn(
            'sm:max-w-md',
            currentStep.placement === 'center' && 'top-1/2 -translate-y-1/2',
            className
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (!config.allowSkip) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl">
                  {currentStep.title}
                </DialogTitle>
                {config.showProgress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      Step {currentStepIndex + 1} of {steps.length}
                    </span>
                  </div>
                )}
              </div>
              {config.allowSkip && (
                <button
                  onClick={handleClose}
                  className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              )}
            </div>
            {currentStep.content && (
              <DialogDescription className="text-base pt-2">
                {currentStep.content}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Progress bar */}
          {config.showProgress && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-in-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Step indicators */}
          {steps.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentStepIndex(index);
                    onStepChange?.(index);
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    index === currentStepIndex
                      ? 'w-8 bg-primary'
                      : index < currentStepIndex
                      ? 'w-4 bg-primary/50'
                      : 'w-4 bg-muted'
                  )}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex gap-2">
              {config.allowSkip && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-sm"
                >
                  Skip Tour
                </Button>
              )}
              {!isFirstStep && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              )}
            </div>
            <Button
              type="button"
              onClick={handleNext}
              className="gap-1"
            >
              {isLastStep ? (
                <>
                  Get Started
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper hook to manage tour state
export function useTourGuide(config: TourGuideConfig) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  const start = React.useCallback(() => {
    setIsOpen(true);
    setCurrentStep(0);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const complete = React.useCallback(() => {
    setIsOpen(false);
    setCurrentStep(0);
  }, []);

  return {
    isOpen,
    currentStep,
    start,
    close,
    complete,
  };
}
