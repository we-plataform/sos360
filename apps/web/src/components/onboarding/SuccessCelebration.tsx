'use client';

import * as React from 'react';
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
import { CheckCircle2, Trophy } from 'lucide-react';

export interface SuccessCelebrationProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  message?: string;
  milestone?: string;
  icon?: 'check' | 'trophy' | 'star';
  showConfetti?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
  className?: string;
}

export const SuccessCelebration = React.memo(
  React.forwardRef<
  HTMLDivElement,
  SuccessCelebrationProps
>(
  (
    {
      open = false,
      onOpenChange,
      title = 'Congratulations!',
      message = "You've completed a milestone!",
      milestone,
      icon = 'check',
      showConfetti = true,
      autoClose = true,
      autoCloseDelay = 5000,
      className,
    },
    ref
  ) => {
    const [isAnimating, setIsAnimating] = React.useState(false);

    React.useEffect(() => {
      if (open) {
        setIsAnimating(true);
        // Auto-close after delay if enabled
        if (autoClose && onOpenChange) {
          const timer = setTimeout(() => {
            onOpenChange(false);
          }, autoCloseDelay);
          return () => clearTimeout(timer);
        }
      } else {
        setIsAnimating(false);
      }
    }, [open, autoClose, autoCloseDelay, onOpenChange]);

    const IconComponent = icon === 'trophy' ? Trophy : CheckCircle2;

    // Generate confetti pieces
    const confettiPieces = React.useMemo(() => {
      if (!showConfetti || !isAnimating) return [];
      return [...Array(50)].map((_, i) => ({
        id: i,
        delay: Math.random() * 2,
        left: Math.random() * 100,
        duration: 2 + Math.random() * 2,
        color: getRandomColor(),
        size: Math.random() > 0.5 ? 10 : Math.random() > 0.5 ? 8 : 6,
        borderRadius: Math.random() > 0.5 ? '2px' : '50%',
      }));
    }, [showConfetti, isAnimating]);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={ref}
          className={cn(
            'sm:max-w-md overflow-hidden relative',
            className
          )}
        >
          {/* Confetti Animation */}
          {showConfetti && isAnimating && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ zIndex: 1 }}
            >
              {confettiPieces.map((piece) => (
                <div
                  key={piece.id}
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: `${piece.left}%`,
                    width: `${piece.size}px`,
                    height: `${piece.size}px`,
                    backgroundColor: piece.color,
                    borderRadius: piece.borderRadius,
                    animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s`,
                  }}
                />
              ))}
            </div>
          )}

          <DialogHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div
                  className={cn(
                    'flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 animate-in zoom-in-95 duration-500',
                    isAnimating && 'animate-bounce'
                  )}
                >
                  <IconComponent className="w-12 h-12 text-primary" />
                </div>
                {isAnimating && (
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                )}
              </div>
            </div>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            {milestone && (
              <div className="inline-flex items-center justify-center px-3 py-1 mt-2 text-xs font-medium rounded-full bg-primary/10 text-primary mx-auto">
                {milestone}
              </div>
            )}
          </DialogHeader>

          <div className="text-center pb-4">
            <DialogDescription className="text-base">
              {message}
            </DialogDescription>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => onOpenChange?.(false)}
              className="w-full sm:w-auto"
            >
              Continue
            </Button>
          </DialogFooter>

          {/* Confetti Animation Keyframes */}
          <style>{`
            @keyframes confetti-fall {
              0% {
                transform: translateY(-100%) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>
    );
  }
));

SuccessCelebration.displayName = 'SuccessCelebration';

function getRandomColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ef4444', // red
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
