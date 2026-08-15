import React from 'react';
import { cn } from '@/lib/utils';

const variantStyles: Record<string, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-current text-foreground bg-transparent',
  success: 'bg-success/10 text-success border border-success/30',
  warning: 'bg-warning/10 text-warning border border-warning/30',
  muted: 'bg-muted text-muted-foreground border border-border',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        variantStyles[variant] ?? variantStyles.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
