import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingAction?: React.ReactNode;
  isInvalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      leadingIcon,
      trailingAction,
      isInvalid = false,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leadingIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
            {leadingIcon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          aria-invalid={isInvalid}
          className={cn(
            'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            leadingIcon && 'pl-9',
            trailingAction && 'pr-9',
            isInvalid && 'border-destructive focus-ring-destructive',
            className
          )}
          {...props}
        />
        {trailingAction && (
          <div className="absolute right-2 flex items-center">
            {trailingAction}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
