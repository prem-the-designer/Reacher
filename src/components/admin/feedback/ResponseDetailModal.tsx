import React from 'react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { FeedbackResponse } from '@/types/feedback';
import { ThumbsUp, ThumbsDown, Globe, Calendar, User, MessageSquare } from 'lucide-react';

interface ResponseDetailModalProps {
  response: FeedbackResponse | null;
  onClose: () => void;
}

export const ResponseDetailModal: React.FC<ResponseDetailModalProps> = ({ response, onClose }) => {
  if (!response) return null;

  const isPositive = response.rating === 'positive';

  return (
    <Dialog
      open={!!response}
      onClose={onClose}
      title="Feedback Response Details"
      description="Detailed inspection of analyst feedback and search context."
      size="lg"
    >
      <div className="space-y-4 py-2">
        {/* Rating Header */}
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {isPositive ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold capitalize text-foreground">
                {response.rating} Feedback
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Search ID: {response.search_id}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              isPositive
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {isPositive ? 'Positive' : 'Negative'}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Globe className="h-3.5 w-3.5" />
              <span>Target Domain</span>
            </div>
            <p className="font-mono text-foreground font-semibold truncate" title={response.domain}>
              {response.domain}
            </p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <User className="h-3.5 w-3.5" />
              <span>Analyst</span>
            </div>
            <p className="text-foreground font-semibold truncate" title={response.user_name || 'Analyst'}>
              {response.user_name || 'Analyst'}
            </p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Campaign</span>
            </div>
            <p className="text-foreground font-medium truncate" title={response.campaign_name}>
              {response.campaign_name || 'Successful Search Feedback'}
            </p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Calendar className="h-3.5 w-3.5" />
              <span>Submitted</span>
            </div>
            <p className="text-foreground tabular-nums">
              {new Date(response.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Negative Reasons (if applicable) */}
        {!isPositive && response.reasons && response.reasons.length > 0 && (
          <div className="space-y-1.5">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Selected Improvement Reasons
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {response.reasons.map((r, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* User Comment */}
        {response.comment && (
          <div className="space-y-1.5">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Analyst Comment
            </h5>
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              "{response.comment}"
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
