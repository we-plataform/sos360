'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import type { TooltipConfig } from '@lia360/shared';

export interface OnboardingTooltipProps {
  /**
   * Unique identifier for this tooltip
   */
  id: string;

  /**
   * Content to display in the tooltip
   */
  content: string;

  /**
   * Optional title for the tooltip
   */
  title?: string;

  /**
   * Position of the tooltip relative to the trigger
   * @default 'bottom'
   */
  position?: 'top' | 'bottom' | 'left' | 'right';

  /**
   * Only show the tooltip once per session
   * @default false
   */
  showOnce?: boolean;

  /**
   * The element that triggers the tooltip
   */
  children: React.ReactElement;

  /**
   * Whether the tooltip is open (controlled mode)
   */
  open?: boolean;

  /**
   * Callback when the open state changes
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Whether to show a "Don't show again" button
   * @default false
   */
  showDisableButton?: boolean;

  /**
   * Callback when user dismisses the tooltip permanently
   */
  onDisable?: () => void;

  /**
   * Side offset in pixels
   * @default 8
   */
  sideOffset?: number;

  /**
   * Additional className for the tooltip content
   */
  className?: string;
}

export const OnboardingTooltip = React.memo(
  React.forwardRef<
  HTMLDivElement,
  OnboardingTooltipProps
>(
  (
    {
      id,
      content,
      title,
      position = 'bottom',
      showOnce = false,
      children,
      open: controlledOpen,
      onOpenChange,
      showDisableButton = false,
      onDisable,
      sideOffset = 8,
      className,
    },
    ref
  ) => {
    // Internal state for uncontrolled mode
    const [internalOpen, setInternalOpen] = React.useState(false);

    // Track if this tooltip has been shown before (for showOnce functionality)
    const [hasShown, setHasShown] = React.useState(() => {
      if (typeof window === 'undefined') return false;
      const storageKey = `onboarding-tooltip-${id}`;
      return localStorage.getItem(storageKey) === 'true';
    });

    // Use controlled open state if provided, otherwise use internal state
    const open =
      controlledOpen !== undefined ? controlledOpen : internalOpen;

    // Don't show if showOnce is true and it has already been shown
    const shouldShow = !showOnce || !hasShown;

    const handleOpenChange = (newOpen: boolean) => {
      if (newOpen && showOnce && !hasShown) {
        // Mark as shown when opening for the first time
        const storageKey = `onboarding-tooltip-${id}`;
        localStorage.setItem(storageKey, 'true');
        setHasShown(true);
      }

      if (controlledOpen === undefined) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    };

    const handleDisable = () => {
      const storageKey = `onboarding-tooltip-${id}`;
      localStorage.setItem(storageKey, 'true');
      setHasShown(true);
      setInternalOpen(false);
      onDisable?.();
    };

    if (!shouldShow) {
      return <>{children}</>;
    }

    return (
      <TooltipProvider delayDuration={400}>
        <Tooltip open={open} onOpenChange={handleOpenChange}>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent
            ref={ref}
            side={position}
            sideOffset={sideOffset}
            className={cn('max-w-sm', className)}
          >
            <div className="space-y-2">
              {title && (
                <div className="font-semibold text-sm text-foreground">
                  {title}
                </div>
              )}
              <div className="text-sm text-muted-foreground">{content}</div>
              {showDisableButton && (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleDisable}
                  >
                    Don't show again
                  </Button>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
));

OnboardingTooltip.displayName = 'OnboardingTooltip';

// Helper function to create a tooltip config
export function createTooltipConfig(
  config: Omit<TooltipConfig, 'priority'>
): TooltipConfig {
  return {
    ...config,
    priority: 0, // Default priority
  };
}

// Helper function to check if a tooltip has been shown
export function hasTooltipBeenShown(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const storageKey = `onboarding-tooltip-${id}`;
  return localStorage.getItem(storageKey) === 'true';
}

// Helper function to reset a tooltip (mark as not shown)
export function resetTooltip(id: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = `onboarding-tooltip-${id}`;
  localStorage.removeItem(storageKey);
}

// Helper function to reset all onboarding tooltips
export function resetAllTooltips(): void {
  if (typeof window === 'undefined') return;
  Object.keys(localStorage)
    .filter((key) => key.startsWith('onboarding-tooltip-'))
    .forEach((key) => localStorage.removeItem(key));
}
