import React, { useState, useEffect } from 'react';
import { getFeedbackSettings, updateFeedbackSettings } from '@/services/feedbackService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { CheckCircle2, Save, ShieldCheck, Clock } from 'lucide-react';

export const FeedbackSettingsView: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drafts
  const [enabled, setEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState('24');
  const [maxPrompts, setMaxPrompts] = useState('3');
  const [requirePreview, setRequirePreview] = useState(true);
  const [requireArchiveConfirm, setRequireArchiveConfirm] = useState(true);
  const [requireVersioning, setRequireVersioning] = useState(true);

  useEffect(() => {
    getFeedbackSettings().then((s) => {
      setEnabled(s.enabled);
      setCooldownHours(String(s.global_cooldown_hours || 24));
      setMaxPrompts(String(s.max_prompts_per_day || 3));
      setRequirePreview(s.require_preview_before_publish);
      setRequireArchiveConfirm(s.require_archive_confirmation);
      setRequireVersioning(s.require_versioning);
    });
  }, []);

  const handleSave = async () => {
    const cd = parseInt(cooldownHours, 10);
    const maxP = parseInt(maxPrompts, 10);

    if (isNaN(cd) || cd < 0) {
      setError('Global cooldown must be a valid non-negative number of hours.');
      return;
    }
    if (isNaN(maxP) || maxP < 1) {
      setError('Maximum prompts per day must be at least 1.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateFeedbackSettings({
        enabled,
        global_cooldown_hours: cd,
        max_prompts_per_day: maxP,
        require_preview_before_publish: requirePreview,
        require_archive_confirmation: requireArchiveConfirm,
        require_versioning: requireVersioning,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Feedback Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure global policies, pacing, cooldowns, and admin safeguards.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/10 text-success text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          <span>Feedback settings saved successfully.</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" title="Validation Error">
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {/* Global Master Switch */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Feedback System Master Switch</h2>
            <p className="text-xs text-muted-foreground">
              Allow configured feedback campaigns to appear to Analysts after successful searches.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </Card>

      {/* Pacing & Frequency Controls */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>Pacing & Prompt Limits</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prevent fatigue by limiting how often feedback prompts appear to Analysts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Global Analyst Cooldown (Hours)
            </label>
            <Input
              type="number"
              min={0}
              value={cooldownHours}
              onChange={(e) => setCooldownHours(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Minimum duration to wait before presenting another feedback prompt to the same Analyst.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Maximum Prompts Per Analyst Per Day
            </label>
            <Input
              type="number"
              min={1}
              value={maxPrompts}
              onChange={(e) => setMaxPrompts(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Caps the total number of feedback opportunities an Analyst can receive in a single day.
            </p>
          </div>
        </div>
      </Card>

      {/* Safety & Operational Policies */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Safety & Governance Safeguards</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Protective constraints for publishing, archiving, and editing campaigns.
          </p>
        </div>

        <div className="space-y-4 pt-1 divide-y divide-border">
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">
                Require Preview Before Publishing
              </label>
              <p className="text-xs text-muted-foreground">
                Encourages admins to visually verify the prompt state before going live.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requirePreview}
              onChange={(e) => setRequirePreview(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">
                Require Archive Confirmation
              </label>
              <p className="text-xs text-muted-foreground">
                Prompts for confirmation before moving an active or paused campaign to historical records.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requireArchiveConfirm}
              onChange={(e) => setRequireArchiveConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">
                Enforce Version Immutability
              </label>
              <p className="text-xs text-muted-foreground">
                Automatically increments version numbers (e.g. v1 → v2) upon editing published campaigns.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requireVersioning}
              onChange={(e) => setRequireVersioning(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-primary text-primary-foreground shadow-xs"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </Button>
      </div>
    </div>
  );
};
