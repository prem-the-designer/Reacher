import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted/80', className)}
      {...props}
    />
  );
}

export function ResultCardSkeleton() {
  return (
    <div
      className="w-full rounded-xl border border-border bg-card p-6 shadow-xs space-y-5"
      role="status"
      aria-busy="true"
      aria-label="Searching domain database"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>

      <div className="rounded-lg bg-muted/50 p-6 flex flex-col justify-center space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5 p-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      <Skeleton className="h-3 w-64 mx-auto mt-4" />
      <span className="sr-only">Searching domain database...</span>
    </div>
  );
}
