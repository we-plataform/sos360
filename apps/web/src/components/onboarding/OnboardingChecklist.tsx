'use client';

import * as React from 'react';
import { Check, Circle, X, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { OnboardingProgressResponse, OnboardingStepResponse, OnboardingStepType } from '@lia360/shared';

interface ChecklistItem {
  stepType: OnboardingStepType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    stepType: 'install_extension',
    title: 'Install Browser Extension',
    description: 'Add our Chrome extension to capture leads from LinkedIn and websites.',
    actionLabel: 'Install Extension',
    actionHref: '#',
  },
  {
    stepType: 'create_pipeline',
    title: 'Create Your First Pipeline',
    description: 'Set up a sales pipeline to track your leads through the sales process.',
    actionLabel: 'Create Pipeline',
    actionHref: '/pipelines',
  },
  {
    stepType: 'capture_lead',
    title: 'Capture Your First Lead',
    description: 'Add a lead manually or capture one using the browser extension.',
    actionLabel: 'Add Lead',
    actionHref: '/leads/new',
  },
  {
    stepType: 'send_message',
    title: 'Send Your First Message',
    description: 'Start a conversation with one of your leads.',
    actionLabel: 'Go to Leads',
    actionHref: '/leads',
  },
];

interface OnboardingChecklistProps {
  progress?: OnboardingProgressResponse | null;
  onStepAction?: (stepType: OnboardingStepType) => void;
  onDismiss?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function OnboardingChecklist({
  progress,
  onStepAction,
  onDismiss,
  isLoading = false,
  className,
}: OnboardingChecklistProps) {
  const completedSteps = React.useMemo(() => {
    if (!progress?.steps) return new Set<OnboardingStepType>();
    return new Set(
      progress.steps.filter((s) => s.isCompleted).map((s) => s.stepType)
    );
  }, [progress?.steps]);

  const progressPercentage = progress?.progress?.percentage ?? 0;

  const handleStepClick = (item: ChecklistItem) => {
    if (item.actionHref) {
      window.location.href = item.actionHref;
    }
    onStepAction?.(item.stepType);
  };

  const isAllComplete = CHECKLIST_ITEMS.every((item) =>
    completedSteps.has(item.stepType)
  );

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Loading your onboarding progress...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isAllComplete) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            Setup Complete!
          </CardTitle>
          <CardDescription>
            You've completed all the essential setup steps. You're ready to go!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Congratulations!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You're all set up and ready to make the most of Lia360.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Complete these steps to get the most out of Lia360
            </CardDescription>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <ul className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const isCompleted = completedSteps.has(item.stepType);

            return (
              <li key={item.stepType}>
                <button
                  onClick={() => handleStepClick(item)}
                  className={cn(
                    'w-full text-left transition-colors',
                    !isCompleted && 'hover:bg-accent hover:rounded-lg hover:p-3 hover:-mx-3'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {isCompleted ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30">
                          <Circle className="h-2.5 w-2.5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'font-medium',
                            isCompleted
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          )}
                        >
                          {item.title}
                        </span>
                        {!isCompleted && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-sm',
                          isCompleted
                            ? 'text-muted-foreground/70'
                            : 'text-muted-foreground'
                        )}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer help text */}
        <div className="mt-6 rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          Need help? Check our{' '}
          <a
            href="#"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            documentation
          </a>{' '}
          or{' '}
          <a
            href="#"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            contact support
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
