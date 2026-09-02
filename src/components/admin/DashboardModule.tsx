import React, { useEffect, useState } from 'react';
import type { DashboardCardData, DashboardActivity, AdminModule } from '@/types';
import { getDashboardCards, getDashboardActivity } from '@/services/adminService';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { RefreshCw, ArrowRight, AlertCircle, Inbox, Users, CreditCard, UploadCloud } from 'lucide-react';

const CARD_ICONS: Record<string, React.ReactNode> = {
  'card-requests': <Inbox className="h-5 w-5" aria-hidden="true" />,
  'card-users': <Users className="h-5 w-5" aria-hidden="true" />,
  'card-credits': <CreditCard className="h-5 w-5" aria-hidden="true" />,
  'card-import': <UploadCloud className="h-5 w-5" aria-hidden="true" />,
};

const CATEGORY_ICONS: Record<string, string> = {
  request: '→',
  import: '↑',
  user: '◎',
  system: '⚠',
};

interface DashboardModuleProps {
  onNavigate: (module: AdminModule) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const [cards, setCards] = useState<DashboardCardData[]>([]);
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const [isCriticalCredit, setIsCriticalCredit] = useState(false);

  const loadCards = async (silent = false) => {
    if (!silent) setCardsLoading(true);
    try {
      const data = await getDashboardCards();
      setCards(data);
      
      // Also check critical credits for the caution sign
      const { getSettings } = await import('@/services/adminService');
      const settings = await getSettings();
      const creds = settings.credits;
      if (creds?.current_credits != null && creds?.critical_threshold != null) {
        setIsCriticalCredit(creds.current_credits <= creds.critical_threshold);
      } else {
        setIsCriticalCredit(false);
      }
    } catch {
      // Each card tracks its own state; this is a fallback
      setCards((prev) =>
        prev.map((c) => ({ ...c, status: 'unavailable' as const }))
      );
    } finally {
      if (!silent) setCardsLoading(false);
    }
  };

  const loadActivity = async (silent = false) => {
    if (!silent) setActivityLoading(true);
    setActivityError(false);
    try {
      const data = await getDashboardActivity();
      setActivity(data);
    } catch {
      setActivityError(true);
    } finally {
      if (!silent) setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
    loadActivity();

    const interval = setInterval(() => {
      loadCards(true); // silent fetch
      loadActivity(true); // silent fetch
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">What requires your attention today</p>
        </div>
        {isCriticalCredit && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-sm font-medium px-4 py-2 rounded-lg border border-destructive/20 shadow-sm transition-all">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <span>Critical Credit Limit</span>
          </div>
        )}
      </div>

      {/* Status cards — 4-up desktop, 2-up tablet, 1-up mobile */}
      <section aria-label="Status overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {cardsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} elevation="xs" className="p-6 space-y-3">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-8 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                </Card>
              ))
            : cards.map((card) => (
                <DashboardCard
                  key={card.id}
                  card={card}
                  icon={CARD_ICONS[card.id]}
                  onNavigate={onNavigate}
                  onRetry={() => loadCards()}
                />
              ))}
        </div>
      </section>

      {/* Recent activity */}
      <section aria-label="Recent activity">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        </div>

        {activityLoading && (
          <Card elevation="xs" className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </Card>
        )}

        {activityError && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            <span className="text-destructive font-medium">Activity feed unavailable.</span>
            <Button variant="outline" size="sm" onClick={() => loadActivity()} className="ml-auto gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {!activityLoading && !activityError && activity.length === 0 && (
          <Card elevation="xs" className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/30 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              User actions, imports and requests will appear here.
            </p>
          </Card>
        )}

        {!activityLoading && !activityError && activity.length > 0 && (
          <Card elevation="xs" className="divide-y divide-border overflow-hidden">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors duration-150">
                <span className="text-muted-foreground text-xs mt-0.5 w-4 shrink-0 tabular-nums" aria-hidden="true">
                  {CATEGORY_ICONS[item.category] ?? '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
};

// ── Individual status card ────────────────────────────────────────────────────

interface DashboardCardProps {
  card: DashboardCardData;
  icon?: React.ReactNode;
  onNavigate: (module: AdminModule) => void;
  onRetry: () => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ card, icon, onNavigate, onRetry }) => {
  if (card.status === 'loading') {
    return (
      <Card elevation="xs" className="p-6 space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="h-8 w-16 rounded bg-muted animate-pulse" />
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </Card>
    );
  }

  if (card.status === 'unavailable' || card.status === 'permission_error') {
    return (
      <Card elevation="xs" className="p-6 flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {card.status === 'permission_error' ? 'Permission denied' : 'Unavailable'}
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5 text-xs w-fit">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card elevation="xs" className="p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground leading-tight">{card.label}</p>
        {icon && (
          <span className="text-muted-foreground/50 shrink-0">{icon}</span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-3xl font-semibold tabular-nums text-foreground leading-none">
          {card.value !== null && card.value !== undefined
            ? typeof card.value === 'number'
              ? card.value.toLocaleString()
              : card.value
            : '(-)'}
        </span>
        {card.badgeLabel && card.badgeVariant && (
          <StatusBadge status={card.badgeLabel} />
        )}
      </div>

      {card.context && (
        <p className="text-xs text-muted-foreground leading-snug">{card.context}</p>
      )}

      {card.linkModule && (
        <button
          type="button"
          onClick={() => onNavigate(card.linkModule!)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 w-fit mt-auto"
        >
          View details
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </Card>
  );
};
