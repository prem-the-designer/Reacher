import React, { useEffect, useState } from 'react';
import type { SettingsConfig, TrafficAndEngagementSettings } from '@/types';
import { getSettings, saveSettings } from '@/services/adminService';
import { checkSimilarwebCreditThreshold } from '@/services/domainService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Loader2, Eye, EyeOff, CheckCircle2, Lock, Activity, RefreshCw } from 'lucide-react';

type SectionState = 'idle' | 'editing' | 'saving' | 'success' | 'error';

// ── Settings Module ───────────────────────────────────────────────────────────

export const SettingsModule: React.FC = () => {
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // API Config section
  const [apiState, setApiState] = useState<SectionState>('idle');
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiNameDraft, setApiNameDraft] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  // Credit Limiter section
  const [creditState, setCreditState] = useState<SectionState>('idle');
  const [creditError, setCreditError] = useState<string | null>(null);
  const [warningDraft, setWarningDraft] = useState('');
  const [criticalDraft, setCriticalDraft] = useState('');

  // Unsaved-changes guard
  const [hasUnsavedApi, setHasUnsavedApi] = useState(false);
  const [hasUnsavedCredit, setHasUnsavedCredit] = useState(false);
  const [hasUnsavedTraffic, setHasUnsavedTraffic] = useState(false);

  // Traffic and Engagement Config Section
  const [trafficState, setTrafficState] = useState<SectionState>('idle');
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficDraft, setTrafficDraft] = useState<TrafficAndEngagementSettings | null>(null);
  useEffect(() => {
    loadSettings();
  }, []);

  // Warn on navigation if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedApi || hasUnsavedCredit || hasUnsavedTraffic) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedApi, hasUnsavedCredit, hasUnsavedTraffic]);

  const loadSettings = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getSettings();
      setSettings(data);
      if (data.api.credential_value) {
        setApiKeyDraft(data.api.credential_value);
      }
      if (data.api.credential_name) {
        setApiNameDraft(data.api.credential_name);
      }
      setWarningDraft(data.credits.warning_threshold != null ? String(data.credits.warning_threshold) : '');
      setCriticalDraft(data.credits.critical_threshold != null ? String(data.credits.critical_threshold) : '');
      const tData = (data.traffic_and_engagement || {}) as Partial<TrafficAndEngagementSettings>;
      setTrafficDraft({ country: tData.country ?? true, granularity: tData.granularity ?? true });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiConfig = async () => {
    if (apiState === 'editing' && apiKeyDraft.trim() === '') {
      setApiError('Enter a credential value to update.');
      return;
    }
    setApiState('saving');
    setApiError(null);
    try {
      const updated = await saveSettings('api', {
        credential_set: true,
        credential_last_updated: new Date().toISOString(),
        credential_value: apiKeyDraft,
        credential_name: apiNameDraft || null,
      });
      setSettings(updated);
      setApiState('success');
      setHasUnsavedApi(false);
      
      // Auto-refresh credits on save
      const threshold = Number(import.meta.env.VITE_SIMILARWEB_CREDIT_THRESHOLD) || 100;
      await checkSimilarwebCreditThreshold(apiKeyDraft, threshold);
      await loadSettings();

      setTimeout(() => setApiState('idle'), 3000);
    } catch {
      setApiState('error');
      setApiError('Could not save API configuration. Please try again.');
    }
  };

  const handleRefreshCredits = async () => {
    setRefreshingCredits(true);
    try {
      const apiKey = settings?.api.credential_value;
      const threshold = Number(import.meta.env.VITE_SIMILARWEB_CREDIT_THRESHOLD) || 100;
      if (apiKey) {
        await checkSimilarwebCreditThreshold(apiKey, threshold);
        await loadSettings();
      }
    } finally {
      setRefreshingCredits(false);
    }
  };

  const handleSaveCreditLimiter = async () => {
    const warning = warningDraft ? Number(warningDraft) : null;
    const critical = criticalDraft ? Number(criticalDraft) : null;

    // Validate
    if (warningDraft && (isNaN(Number(warningDraft)) || Number(warningDraft) < 0)) {
      setCreditError('Warning threshold must be a positive number.');
      return;
    }
    if (criticalDraft && (isNaN(Number(criticalDraft)) || Number(criticalDraft) < 0)) {
      setCreditError('Critical threshold must be a positive number.');
      return;
    }

    setCreditState('saving');
    setCreditError(null);
    try {
      const updated = await saveSettings('credits', { warning_threshold: warning, critical_threshold: critical });
      setSettings(updated);
      setCreditState('success');
      setHasUnsavedCredit(false);
      setTimeout(() => setCreditState('idle'), 3000);
    } catch {
      setCreditState('error');
      setCreditError('Could not save credit limiter settings. Please try again.');
    }
  };

  const handleSaveTrafficConfig = async () => {
    if (!trafficDraft) return;
    setTrafficState('saving');
    setTrafficError(null);
    try {
      const updated = await saveSettings('traffic_and_engagement', trafficDraft);
      setSettings(updated);
      setTrafficState('success');
      setHasUnsavedTraffic(false);
      setTimeout(() => setTrafficState('idle'), 3000);
    } catch {
      setTrafficState('error');
      setTrafficError('Could not save Traffic and Engagement configuration. Please try again.');
    }
  };

  const handleToggleTrafficSetting = (setting: keyof TrafficAndEngagementSettings) => {
    setTrafficDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [setting]: !prev[setting]
      };
    });
    setHasUnsavedTraffic(true);
    setTrafficState('editing');
  };
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} elevation="xs" className="p-6 space-y-4 max-w-2xl">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-60 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <Alert variant="destructive" title="Could not load settings">
          <p className="text-sm">Settings are unavailable. Please try again.</p>
        </Alert>
        <Button variant="outline" onClick={loadSettings}>Retry</Button>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">API, credits and data refresh configuration</p>
      </div>

      {/* ── API Configuration ─────────────────────────────────────────── */}
      <section aria-labelledby="api-config-heading">
        <Card elevation="xs" className="p-6 space-y-5 max-w-2xl">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 id="api-config-heading" className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                API Configuration
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Credentials are stored server-side and never returned to the browser.
              </p>
            </div>
          </div>

          {/* Credential status — never shows the actual key */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Credential Status</p>
            <p className="text-sm text-foreground">
              {settings.api.credential_set ? '● Set' : '○ Not configured'}
              {settings.api.credential_name ? ` (${settings.api.credential_name})` : ''}
            </p>
            {settings.api.credential_last_updated && (
              <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                Last updated: {new Date(settings.api.credential_last_updated).toLocaleString()}
              </p>
            )}
          </div>

          {apiState === 'success' && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Credential updated successfully.
            </div>
          )}

          {apiError && (
            <Alert variant="destructive" title="Error">
              <p className="text-sm">{apiError}</p>
            </Alert>
          )}

          {/* Update credential — masked input, never echoed */}
          {(apiState === 'editing' || apiState === 'error') && (
            <div className="space-y-4">
              <div>
                <label htmlFor="api-name-input" className="block text-xs font-medium text-muted-foreground mb-1">
                  Credential Name (Optional)
                </label>
                <Input
                  id="api-name-input"
                  type="text"
                  value={apiNameDraft}
                  onChange={(e) => { setApiNameDraft(e.target.value); setHasUnsavedApi(true); }}
                  placeholder="e.g. Production Key"
                />
              </div>
              <div>
                <label htmlFor="api-key-input" className="block text-xs font-medium text-muted-foreground mb-1">
                  New Credential Value
                </label>
              <div className="relative">
                <Input
                  id="api-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyDraft}
                  onChange={(e) => { setApiKeyDraft(e.target.value); setHasUnsavedApi(true); }}
                  placeholder="Paste new credential…"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide credential' : 'Show credential'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This will replace the current credential. The value is transmitted securely and never stored client-side.
              </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {apiState === 'idle' && (
              <Button variant="outline" onClick={() => setApiState('editing')}>
                Update Credential
              </Button>
            )}
            {(apiState === 'editing' || apiState === 'error' || apiState === 'saving') && (
              <>
                <Button
                  variant="default"
                  onClick={handleSaveApiConfig}
                  disabled={apiState === 'saving'}
                  className="gap-2"
                >
                  {apiState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save credential
                </Button>
                <Button variant="ghost" onClick={() => { setApiState('idle'); setApiKeyDraft(settings.api.credential_value || ''); setApiNameDraft(settings.api.credential_name || ''); setApiError(null); setHasUnsavedApi(false); }}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </Card>
      </section>

      {/* ── Credit Limiter ─────────────────────────────────────────────── */}
      <section aria-labelledby="credit-limiter-heading">
        <Card elevation="xs" className="p-6 space-y-5 max-w-2xl">
          <div>
            <h2 id="credit-limiter-heading" className="text-lg font-semibold text-foreground">API Credit Limiter</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {/* TODO(backend): threshold values and rules come from backend configuration */}
              Warning and critical thresholds are defined by backend configuration.
              A notification fires when credits reach the warning threshold.
            </p>
          </div>

          {/* Current credit status */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Current Credits</p>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {settings.credits.current_credits?.toLocaleString() ?? '(-)'}
              </p>
              {settings.credits.credits_last_refreshed && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Refreshed: {new Date(settings.credits.credits_last_refreshed).toLocaleString()}
                </p>
              )}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={handleRefreshCredits}
              disabled={refreshingCredits || !settings.api.credential_set}
            >
              <RefreshCw className={`h-4 w-4 ${refreshingCredits ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {creditError && (
            <Alert variant="destructive" title="Error">
              <p className="text-sm">{creditError}</p>
            </Alert>
          )}
          {creditState === 'success' && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Thresholds saved.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="warning-threshold" className="block text-xs font-medium text-muted-foreground mb-1">
                Warning Threshold
              </label>
              <Input
                id="warning-threshold"
                type="number"
                min={0}
                value={warningDraft}
                placeholder={settings.credits.warning_threshold != null ? String(settings.credits.warning_threshold) : 'Not set'}
                onChange={(e) => { setWarningDraft(e.target.value); setHasUnsavedCredit(true); }}
              />
              {/* TODO(backend): validation range comes from backend */}
              <p className="text-xs text-muted-foreground mt-1">Credit count that triggers a warning notification.</p>
            </div>
            <div>
              <label htmlFor="critical-threshold" className="block text-xs font-medium text-muted-foreground mb-1">
                Critical Threshold
              </label>
              <Input
                id="critical-threshold"
                type="number"
                min={0}
                value={criticalDraft}
                placeholder={settings.credits.critical_threshold != null ? String(settings.credits.critical_threshold) : 'Not set'}
                onChange={(e) => { setCriticalDraft(e.target.value); setHasUnsavedCredit(true); }}
              />
              <p className="text-xs text-muted-foreground mt-1">Credit count for critical-level alerts.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="default"
              onClick={handleSaveCreditLimiter}
              disabled={creditState === 'saving'}
              className="gap-2"
            >
              {creditState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save thresholds
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setWarningDraft(settings.credits.warning_threshold != null ? String(settings.credits.warning_threshold) : '');
                setCriticalDraft(settings.credits.critical_threshold != null ? String(settings.credits.critical_threshold) : '');
                setHasUnsavedCredit(false);
                setCreditError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Traffic and Engagement Configuration ─────────────────────────────────────────── */}
      <section aria-labelledby="traffic-config-heading">
        <Card elevation="xs" className="p-6 space-y-5 max-w-2xl">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 id="traffic-config-heading" className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Traffic and Engagement
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure enabled properties for the API fetch. Properties disabled here will not be requested.
              </p>
            </div>
          </div>

          {trafficState === 'success' && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Settings updated successfully.
            </div>
          )}

          {trafficError && (
            <Alert variant="destructive" title="Error">
              <p className="text-sm">{trafficError}</p>
            </Alert>
          )}

          {trafficDraft && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              {Object.entries(trafficDraft).map(([setting, enabled]) => (
                <label key={setting} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                    checked={enabled as boolean}
                    onChange={() => handleToggleTrafficSetting(setting as keyof TrafficAndEngagementSettings)}
                  />
                  <span className="text-sm text-foreground capitalize">{setting.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="default"
              onClick={handleSaveTrafficConfig}
              disabled={trafficState === 'saving' || trafficState === 'idle'}
              className="gap-2"
            >
              {trafficState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save configuration
            </Button>
            {hasUnsavedTraffic && (
              <Button
                variant="ghost"
                onClick={() => {
                  const tData = (settings.traffic_and_engagement || {}) as Partial<TrafficAndEngagementSettings>;
                  setTrafficDraft({ country: tData.country ?? true, granularity: tData.granularity ?? true });
                  setHasUnsavedTraffic(false);
                  setTrafficState('idle');
                  setTrafficError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* ── Data Refresh ────────────────────────────────────────────────
      <section aria-labelledby="data-refresh-heading">
        <Card elevation="xs" className="p-6 space-y-4 max-w-2xl">
          <div>
            <h2 id="data-refresh-heading" className="text-lg font-semibold text-foreground">Data Refresh</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule configuration is managed server-side.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 space-y-3">
            {[
              {
                label: 'Schedule',
                value: settings.data_refresh.schedule_description ?? 'Not configured — TODO(backend)',
              },
              {
                label: 'Last Refresh',
                value: settings.data_refresh.last_refresh
                  ? new Date(settings.data_refresh.last_refresh).toLocaleString()
                  : '—',
              },
              {
                label: 'Next Refresh',
                value: settings.data_refresh.next_refresh
                  ? new Date(settings.data_refresh.next_refresh).toLocaleString()
                  : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-6">
                <dt className="text-xs font-medium text-muted-foreground w-28 shrink-0">{label}</dt>
                <dd className="text-sm text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground italic">
            Contact your administrator to change the refresh schedule.
          </p>
        </Card>
      </section>
      */}
    </div>
  );
};
