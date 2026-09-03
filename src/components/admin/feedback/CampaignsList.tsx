import React, { useState } from 'react';
import type { FeedbackCampaign } from '@/types/feedback';
import { pauseCampaign, publishCampaign, archiveCampaign, duplicateCampaign } from '@/services/feedbackService';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { FeedbackPreviewModal } from './FeedbackPreviewModal';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Pause,
  Play,
  Archive,
  Copy,
  MessageSquare,
} from 'lucide-react';

interface CampaignsListProps {
  campaigns: FeedbackCampaign[];
  onCreate: () => void;
  onSelect: (campaign: FeedbackCampaign) => void;
  onEdit: (campaign: FeedbackCampaign) => void;
  onRefresh: () => void;
  onTestOnMyself?: (campaign: FeedbackCampaign) => void;
}

export const CampaignsList: React.FC<CampaignsListProps> = ({
  campaigns,
  onCreate,
  onSelect,
  onEdit,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewCampaign, setPreviewCampaign] = useState<FeedbackCampaign | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<FeedbackCampaign | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Exclude archived from primary campaigns list (they live in Archive tab)
  const nonArchived = campaigns.filter((c) => c.status !== 'archived');

  const filtered = nonArchived.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.feedback_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleTogglePause = async (e: React.MouseEvent, c: FeedbackCampaign) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      if (c.status === 'active') {
        await pauseCampaign(c.id);
      } else {
        await publishCampaign(c.id);
      }
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, c: FeedbackCampaign) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await duplicateCampaign(c.id);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      await archiveCampaign(archiveTarget.id, 'Admin', archiveReason);
      setArchiveTarget(null);
      setArchiveReason('');
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const previewVersion = previewCampaign?.versions?.find(
    (v) => v.id === previewCampaign.current_version_id
  ) || previewCampaign?.versions?.[0];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Feedback Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage feedback experiences shown to Analysts.
          </p>
        </div>

        <Button onClick={onCreate} className="gap-2 bg-primary text-primary-foreground shadow-xs">
          <Plus className="h-4 w-4" />
          <span>Create Campaign</span>
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 text-xs w-full sm:w-auto overflow-x-auto">
          {['all', 'active', 'paused', 'draft'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                statusFilter === st
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Table or Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-foreground">No feedback campaigns yet</h3>
            <p className="text-xs text-muted-foreground">
              Create your first feedback campaign to start collecting Analyst feedback after successful searches.
            </p>
          </div>
          <Button onClick={onCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-medium">Campaign</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Version</th>
                  <th className="py-3 px-4 font-medium">Trigger</th>
                  <th className="py-3 px-4 font-medium">Audience</th>
                  <th className="py-3 px-4 font-medium">Updated</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((campaign) => {
                  const ver =
                    campaign.versions?.find((v) => v.id === campaign.current_version_id) ||
                    campaign.versions?.[0];
                  return (
                    <tr
                      key={campaign.id}
                      onClick={() => onSelect(campaign)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{campaign.name}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                          {campaign.description}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">Successful Search</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-semibold ${
                            campaign.status === 'active'
                              ? 'border-success/30 bg-success/10 text-success'
                              : campaign.status === 'paused'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'border-border text-muted-foreground bg-muted/20'
                          }`}
                        >
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {ver?.version_label || `v${campaign.current_version_number}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">Successful single-domain</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-foreground font-medium">
                          {campaign.audience}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-muted-foreground whitespace-nowrap">
                        {new Date(campaign.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Preview experience"
                            onClick={() => setPreviewCampaign(campaign)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit campaign"
                            onClick={() => onEdit(campaign)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                            onClick={(e) => handleTogglePause(e, campaign)}
                            className="h-8 w-8 p-0"
                          >
                            {campaign.status === 'active' ? (
                              <Pause className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-success" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Duplicate"
                            onClick={(e) => handleDuplicate(e, campaign)}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Archive"
                            onClick={() => setArchiveTarget(campaign)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Archive className="h-3.5 w-3.5" />
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

      {/* Preview Modal */}
      {previewCampaign && (
        <FeedbackPreviewModal
          open={!!previewCampaign}
          onClose={() => setPreviewCampaign(null)}
          question={previewVersion?.question || 'Was this result useful?'}
          config={
            previewVersion?.configuration || {
              positive_label: 'Yes',
              negative_label: 'No',
              negative_reasons: [],
              comment_enabled: true,
            }
          }
        />
      )}

      {/* Archive Modal */}
      <Dialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="Archive Campaign?"
        description="Archiving stops this campaign from appearing to Analysts. Existing responses and campaign history will be preserved."
        size="md"
      >
        <div className="space-y-3 py-2 text-xs">
          <label className="text-xs font-medium text-foreground">Archive Reason (Optional)</label>
          <input
            type="text"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="e.g. Campaign ended or superseded"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#A1A1A1]/80"
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setArchiveTarget(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmArchive}
            disabled={actionLoading}
            className="gap-1.5"
          >
            <Archive className="h-4 w-4" />
            <span>Archive Campaign</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
