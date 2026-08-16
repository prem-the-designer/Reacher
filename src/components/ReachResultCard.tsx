import React, { useState } from 'react';
import { DomainRecord } from '@/types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { formatDate, formatNumber, cn } from '@/lib/utils';
import { Globe, Calendar, Layers, Flag, Tv, Building2, Copy, Check, RefreshCw } from 'lucide-react';

interface ReachResultCardProps {
  record: DomainRecord;
  onRefresh?: () => void;
}

export const ReachResultCard: React.FC<ReachResultCardProps> = ({ record, onRefresh }) => {
  const metadataItems = [
    {
      key: 'provider',
      label: 'Provider',
      value: record.provider,
      icon: <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
    {
      key: 'country',
      label: 'Country',
      value: record.country,
      icon: <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
    {
      key: 'media_type',
      label: 'Media Type',
      value: record.media_type,
      icon: <Tv className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
    {
      key: 'publication',
      label: 'Publication',
      value: record.publication,
      icon: <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
    {
      key: 'granularity',
      label: 'Granularity',
      value: record.granularity,
      icon: <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
    {
      key: 'last_updated',
      label: 'Last Updated',
      value: record.last_updated ? formatDate(record.last_updated) : null,
      icon: <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />,
    },
  ];

  const isMasterDB = record.data_source === 'Master Database';

  // Quarterly staleness: flag if last_updated is >= 90 days ago
  const isStale = (() => {
    if (!record.last_updated) return false;
    const updated = new Date(record.last_updated).getTime();
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    return now - updated >= ninetyDaysMs;
  })();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const raw = record.reach_value.toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raw);
      } else {
        // Fallback for non-secure contexts
        const el = document.createElement('textarea');
        el.value = raw;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently swallow — copy failure is non-critical
    }
  };

  return (
    <Card elevation="xs" className="w-full p-5 sm:p-6 space-y-6 transition-all">
      {/* Level 2: Domain + Data Source Badge + Stale Refresh on same row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span
            className="text-sm font-medium text-foreground tracking-tight truncate max-w-[200px] sm:max-w-[340px]"
            title={record.domain_name}
          >
            {record.domain_name}
          </span>

          {/* Quarterly-stale refresh button — shown only when data is ≥90 days old */}
          {isStale && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 shrink-0">
                <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
                Outdated
              </span>
              <button
                id="refresh-reach-button"
                type="button"
                onClick={onRefresh}
                title="Refresh to get latest reach value"
                aria-label="Refresh to get latest reach value"
                className={[
                  'shrink-0 flex items-center justify-center rounded-md p-1.5 transition-all duration-150',
                  'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
                  'hover:bg-amber-400/15 border border-transparent hover:border-amber-400/40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-1',
                ].join(' ')}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Data source badge per §7: secondary variant for Master DB, outline for API Fetch */}
        <Badge variant={isMasterDB ? 'secondary' : 'outline'} className="gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
          <span>{record.data_source}</span>
        </Badge>
      </div>

      {/* Level 1: Reach Value in muted inset panel per §7 — copy button at panel edge */}
      <div className="relative rounded-lg bg-muted/60 p-5 sm:p-6 text-center sm:text-left space-y-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Monthly Reach Value
        </span>
        <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground tabular-nums">
          {formatNumber(record.reach_value)}
        </div>

        {/* Copy button — top-right corner of the panel */}
        <button
          id="copy-reach-button"
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy reach value'}
          title={copied ? 'Copied!' : 'Copy reach value'}
          className={cn(
            'absolute top-3 right-3 flex items-center justify-center rounded-md p-1.5 transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80 focus-visible:ring-offset-1',
            copied
              ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
          )}
        >
          {copied
            ? <Check className="h-4 w-4" aria-hidden="true" />
            : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Level 3: Metadata <dl> grid (3 cols desktop, 2 cols tablet, 1 col mobile) */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 pt-1">
        {metadataItems.map((item) => (
          <div key={item.key} className="space-y-1 p-2 rounded-md hover:bg-muted/30 transition-colors">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {item.icon}
              <span>{item.label}</span>
            </dt>
            <dd className="text-sm font-medium tracking-tight text-foreground tabular-nums pl-5">
              {item.value ? (
                <span>{item.value}</span>
              ) : (
                <span className="text-muted-foreground font-mono" aria-label="Not available">
                  —
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Footnote for unavailable metadata per §7 & §12 */}
      <div className="pt-2 border-t border-border/50 text-center sm:text-left">
        <p className="text-xs text-muted-foreground italic">
          — means this value isn't available yet, not that anything failed.
        </p>
      </div>
    </Card>
  );
};
