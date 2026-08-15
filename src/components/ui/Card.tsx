import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'xs' | 'sm' | 'md' | 'none';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = 'xs', children, ...props }, ref) => {
    const elevationClasses = {
      none: 'border border-border',
      xs: 'border border-border shadow-xs',
      sm: 'border border-border shadow-sm',
      md: 'border border-border shadow-md',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl bg-card text-card-foreground transition-shadow',
          elevationClasses[elevation],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
