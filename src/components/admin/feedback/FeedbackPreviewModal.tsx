import React, { useState } from 'react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { FeedbackCampaignVersionConfig } from '@/types/feedback';
import { CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

interface FeedbackPreviewModalProps {
  open: boolean;
  onClose: () => void;
  question: string;
  config: FeedbackCampaignVersionConfig;
}

export const FeedbackPreviewModal: React.FC<FeedbackPreviewModalProps> = ({
  open,
  onClose,
  question,
  config,
}) => {
  const [state, setState] = useState<'prompt' | 'negative' | 'submitted'>('prompt');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const handleReset = () => {
    setState('prompt');
    setSelectedReasons([]);
    setComment('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const toggleReason = (label: string) => {
    setSelectedReasons((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Feedback Experience Preview"
      description="Interactive preview of how this feedback campaign appears to Analysts after a successful search."
      size="lg"
    >
      <div className="space-y-6 py-2">
        {/* Mock search result header */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 select-none pointer-events-none opacity-85">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Domain Result
            </span>
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold font-mono text-foreground">example.com</span>
            <span className="text-sm text-muted-foreground font-mono">1.24M Reach Value</span>
          </div>
        </div>

        {/* The Feedback Component */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Interactive Analyst Feedback Component</span>
          </div>

          {state === 'prompt' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{question}</h4>
                  <p className="text-xs text-muted-foreground">Your feedback helps improve reach accuracy.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setState('submitted')}
                  className="flex-1 sm:flex-none border-border hover:bg-muted"
                >
                  {config.positive_label || 'Yes'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setState('negative')}
                  className="flex-1 sm:flex-none border-border hover:bg-muted"
                >
                  {config.negative_label || 'No'}
                </Button>
              </div>
            </div>
          )}

          {state === 'negative' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">What could be improved?</h4>
                <p className="text-xs text-muted-foreground">Select all that apply.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {config.negative_reasons.map((reason) => {
                  const isChecked = selectedReasons.includes(reason.label);
                  return (
                    <label
                      key={reason.id}
                      onClick={() => toggleReason(reason.label)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
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

              {config.comment_enabled && (
                <div className="space-y-1 pt-1">
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
                <Button variant="ghost" size="sm" onClick={() => setState('prompt')}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={() => setState('submitted')}>
                  Submit Feedback
                </Button>
              </div>
            </div>
          )}

          {state === 'submitted' && (
            <div className="flex items-center justify-between py-2 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2.5 text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Thanks for your feedback.</p>
                  <p className="text-xs text-muted-foreground">Preview response was not saved to production.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Preview
              </Button>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={handleClose}>
          Close Preview
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
