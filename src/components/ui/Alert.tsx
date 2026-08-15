import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'info' | 'success';
  title?: string;
  action?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', title, action, children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-muted/60 border-border text-foreground',
      destructive: 'bg-destructive/10 border-destructive/30 text-destructive dark:text-red-400',
      info: 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200',
      success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200',
    };

    const icons = {
      default: <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />,
      destructive: <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />,
      info: <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />,
      success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />,
    };

    return (
      <div
        ref={ref}
        role={variant === 'destructive' ? 'alert' : 'status'}
        className={cn(
          'relative w-full rounded-lg border p-4 text-sm flex gap-3 items-start transition-colors',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="flex-1 space-y-1">
          {title && <h5 className="font-medium leading-none tracking-tight">{title}</h5>}
          <div className="text-sm opacity-90 leading-relaxed">{children}</div>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
