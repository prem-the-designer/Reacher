/**
 * StatusBadge — single source of truth for status → Badge variant mapping (§4.7)
 * Every table and detail view reads from this module to stay consistent.
 */
import React from 'react';
import { Badge } from './Badge';
import { Clock, CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import type { ReachRequestStatus, UserStatus, ImportJobStatus } from '@/types';

type StatusValue = ReachRequestStatus | UserStatus | ImportJobStatus | string;

interface StatusConfig {
  variant: 'secondary' | 'success' | 'destructive' | 'muted' | 'warning' | 'outline';
  icon: React.ReactNode;
  label: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Reach Request statuses
  pending: {
    variant: 'secondary',
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
    label: 'Pending',
  },
  processing: {
    variant: 'warning',
    icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    label: 'Processing',
  },
  fulfilled: {
    variant: 'success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    label: 'Fulfilled',
  },
  failed: {
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
    label: 'Failed',
  },
  // User statuses
  active: {
    variant: 'success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    label: 'Active',
  },
  inactive: {
    variant: 'muted',
    icon: <MinusCircle className="h-3 w-3" aria-hidden="true" />,
    label: 'Inactive',
  },
  // Import statuses
  complete: {
    variant: 'success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    label: 'Complete',
  },
  validating: {
    variant: 'secondary',
    icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    label: 'Validating',
  },
  validation_complete: {
    variant: 'warning',
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
    label: 'Awaiting Confirmation',
  },
  importing: {
    variant: 'warning',
    icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    label: 'Importing',
  },
  uploading: {
    variant: 'secondary',
    icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    label: 'Uploading',
  },
  // API log statuses
  success: {
    variant: 'success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    label: 'Success',
  },
  rate_limited: {
    variant: 'warning',
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
    label: 'Rate Limited',
  },
  // Error log statuses
  open: {
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
    label: 'Open',
  },
  resolved: {
    variant: 'muted',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    label: 'Resolved',
  },
};

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = STATUS_MAP[status] ?? {
    variant: 'secondary' as const,
    icon: null,
    label: status,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.icon}
      {config.label}
    </Badge>
  );
};
