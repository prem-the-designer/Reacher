import React, { useState } from 'react';
import type { FeedbackCampaign, FeedbackCampaignVersion } from '@/types/feedback';
import { submitResponse } from '@/services/feedbackService';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

interface SearchFeedbackWidgetProps {
  campaign: FeedbackCampaign;
  version: FeedbackCampaignVersion;
  searchId: string;
  domain: string;
  userId: string;
  userName?: string;
  isTest?: boolean;
}

export const SearchFeedbackWidget: React.FC<SearchFeedbackWidgetProps> = ({
  campaign,
  version,
  searchId,
  domain,
  userId,
  userName,
  isTest = false,
}) => {
  const [state, setState] = useState<'initial' | 'negative' | 'submitting' | 'success' | 'error'>('initial');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [pendingRating, setPendingRating] = useState<'positive' | 'negative' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const config = version.configuration;

  const toggleReason = (label: string) => {
    setSelectedReasons((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]
    );
  };

  const handlePositiveClick = async () => {
    setPendingRating('positive');
    setState('submitting');
    setErrorMessage(null);
    try {
      await submitResponse({
        campaign_id: campaign.id,
        campaign_version_id: version.id,
        campaign_name: campaign.name,
        version_label: version.version_label,
        user_id: userId,
        user_name: userName,
        search_id: searchId,
        feedback_type: 'successful_search',
        rating: 'positive',
        reasons: [],
        comment: undefined,
        domain,
        is_test: isTest,
      });
      setState('success');
    } catch {
      setState('error');
      setErrorMessage("We couldn't submit your feedback. Please try again.");
    }
  };

  const handleNegativeSubmit = async () => {
    setPendingRating('negative');
    setState('submitting');
    setErrorMessage(null);
    try {
      await submitResponse({
        campaign_id: campaign.id,
        campaign_version_id: version.id,
        campaign_name: campaign.name,
        version_label: version.version_label,
        user_id: userId,
        user_name: userName,
        search_id: searchId,
        feedback_type: 'successful_search',
        rating: 'negative',
        reasons: selectedReasons,
        comment: comment.trim() || undefined,
        domain,
        is_test: isTest,
      });
      setState('success');
    } catch {
      setState('error');
      setErrorMessage("We couldn't submit your feedback. Please try again.");
    }
  };

  const handleCancel = () => {
    // Return to initial state without recording negative feedback
    setState('initial');
    setSelectedReasons([]);
    setComment('');
  };

  const handleRetry = () => {
    if (pendingRating === 'positive') {
      handlePositiveClick();
    } else if (pendingRating === 'negative') {
      handleNegativeSubmit();
    }
  };

  return (
    <section
      aria-label="Search Result Feedback"
      className="mt-4 rounded-xl border border-border bg-card/80 p-4 sm:p-5 shadow-xs transition-all"
    >
      {/* Test Mode Banner */}
      {isTest && (
        <div className="mb-3 px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Test Mode — This response will not be included in production feedback.</span>
        </div>
      )}

      {/* Initial Prompt State */}
      {state === 'initial' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {version.question || 'Was this result useful?'}
              </p>
              <p className="text-xs text-muted-foreground">
                Help us tune reach estimate accuracy for {domain}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePositiveClick}
              className="flex-1 sm:flex-none h-8 px-4 text-xs font-medium border-border hover:bg-muted"
            >
              {config?.positive_label || 'Yes'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState('negative')}
              className="flex-1 sm:flex-none h-8 px-4 text-xs font-medium border-border hover:bg-muted"
            >
              {config?.negative_label || 'No'}
            </Button>
          </div>
        </div>
      )}

      {/* Negative Follow-Up State */}
      {state === 'negative' && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-foreground">What could be improved?</h4>
            <p className="text-xs text-muted-foreground">
              Select all reasons that apply to this reach result.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(config?.negative_reasons || []).map((reason) => {
              const isChecked = selectedReasons.includes(reason.label);
              return (
                <label
                  key={reason.id}
                  onClick={() => toggleReason(reason.label)}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-primary/50 bg-primary/5 text-foreground font-medium'
                      : 'border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>{reason.label}</span>
                </label>
              );
            })}
          </div>

          {config?.comment_enabled && (
            <div className="space-y-1">
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={config.comment_placeholder || 'Tell us more (optional)'}
                maxLength={config.comment_max_length || 500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A1A1A1]/80"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                {comment.length} / {config.comment_max_length || 500}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNegativeSubmit}
              className="h-8 px-4 text-xs font-medium bg-primary text-primary-foreground"
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      )}

      {/* Submitting State */}
      {state === 'submitting' && (
        <div className="flex items-center gap-2.5 py-1 text-xs text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Submitting feedback…</span>
        </div>
      )}

      {/* Success State */}
      {state === 'success' && (
        <div className="flex items-center justify-between py-1 text-xs text-success animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground">Thanks for your feedback.</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Response recorded</span>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="flex items-center justify-between gap-3 py-1 text-xs text-destructive animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage || "We couldn't submit your feedback. Please try again."}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} className="h-7 text-xs gap-1">
            <RefreshCw className="h-3 w-3" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </section>
  );
};
