import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const scoreBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        high: 'border-transparent bg-amber-500 text-white shadow hover:bg-amber-600',
        medium: 'border-transparent bg-blue-500 text-white shadow hover:bg-blue-600',
        low: 'border-transparent bg-gray-500 text-white shadow hover:bg-gray-600',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'low',
      size: 'default',
    },
  }
);

export interface ScoreBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof scoreBadgeVariants> {
  score: number;
  showLabel?: boolean;
}

function ScoreBadge({
  score,
  showLabel = false,
  className,
  size,
  ...props
}: ScoreBadgeProps) {
  // Determine variant based on score
  const getVariant = (): 'high' | 'medium' | 'low' => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const variant = getVariant();

  return (
    <div
      className={cn(scoreBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {showLabel && <span className="mr-1">Score:</span>}
      {score}
    </div>
  );
}

export { ScoreBadge, scoreBadgeVariants };
