import React, { useState } from 'react';
import type { FeedbackCampaign } from '@/types/feedback';
import { restoreCampaign, duplicateCampaign } from '@/services/feedbackService';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import {
  RotateCcw,
  Copy,
  Eye,
  Archive,
} from 'lucide-react';

interface ArchiveListProps {
  campaigns: FeedbackCampaign[];
  onSelect: (campaign: FeedbackCampaign) => void;
  onRefresh: () => void;
}

export const ArchiveList: React.FC<ArchiveListProps> = ({ campaigns, onSelect, onRefresh }) => {
  const [actionTarget, setActionTarget] = useState<FeedbackCampaign | null>(null);
  const [actionType, setActionType] = useState<'restore' | 'duplicate' | null>(null);
  const [loading, setLoading] = useState(false);

  const archivedCampaigns = campaigns.filter((c) => c.status === 'archived');

  const handleConfirmAction = async () => {
    if (!actionTarget || !actionType) return;
    setLoading(true);
    try {
      if (actionType === 'restore') {
        await restoreCampaign(actionTarget.id, 'Admin');
      } else if (actionType === 'duplicate') {
        await duplicateCampaign(actionTarget.id, 'Admin');
      }
      setActionTarget(null);
      setActionType(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Feedback Archive
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historical campaigns preserved for auditing and restoration.
        </p>
      </div>

      {/* Table or Empty State */}
      {archivedCampaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Archive className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No archived campaigns</h3>
            <p className="text-xs text-muted-foreground">
              Archived campaigns will appear here. Historical responses remain accessible even after archiving.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-medium">Campaign</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Last Version</th>
                  <th className="py-3 px-4 font-medium">Archived Date</th>
                  <th className="py-3 px-4 font-medium">Archived By</th>
                  <th className="py-3 px-4 font-medium">Previous Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archivedCampaigns.map((c) => {
                  const ver =
                    c.versions?.find((v) => v.id === c.current_version_id) || c.versions?.[0];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelect(c)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {c.archive_reason && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            Reason: {c.archive_reason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Successful Search</td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {ver?.version_label || `v${c.current_version_number}`}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-muted-foreground whitespace-nowrap">
                        {c.archived_at ? new Date(c.archived_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{c.archived_by || 'Admin'}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {c.previous_status || 'active'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Campaign Details"
                            onClick={() => onSelect(c)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Restore Campaign as Draft"
                            onClick={() => {
                              setActionTarget(c);
                              setActionType('restore');
                            }}
                            className="h-8 w-8 p-0 text-primary hover:text-primary"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Duplicate as new Draft"
                            onClick={() => {
                              setActionTarget(c);
                              setActionType('duplicate');
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!actionTarget && !!actionType}
        onClose={() => {
          setActionTarget(null);
          setActionType(null);
        }}
        title={actionType === 'restore' ? 'Restore Archived Campaign?' : 'Duplicate Campaign?'}
        description={
          actionType === 'restore'
            ? 'Restoring will recover this campaign into Draft status so you can review and republish it safely.'
            : 'Duplicating will create a new campaign in Draft status with historical configuration copied.'
        }
        size="md"
      >
        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <span className="text-muted-foreground">Campaign:</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">{actionTarget?.name}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setActionTarget(null);
              setActionType(null);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirmAction}
            disabled={loading}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            {actionType === 'restore' ? (
              <>
                <RotateCcw className="h-4 w-4" />
                <span>Restore to Draft</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Duplicate</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
