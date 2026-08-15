import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'h11' | 'icon';
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      isLoading = false,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium text-sm transition-colors rounded-md focus-ring disabled:pointer-events-none disabled:opacity-50 select-none relative min-h-[44px] sm:min-h-0';

    const variantStyles = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-ring-destructive active:bg-destructive/95',
      icon: 'hover:bg-accent hover:text-accent-foreground p-2 min-h-[44px] min-w-[44px]',
    };

    const sizeStyles = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3 text-xs',
      lg: 'h-11 px-8 text-base',
      h11: 'h-11 px-5 text-sm',
      icon: 'h-10 w-10 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>{loadingText || children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
