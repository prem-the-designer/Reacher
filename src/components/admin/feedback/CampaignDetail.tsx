import React, { useState, useEffect } from 'react';
import type { FeedbackCampaign, FeedbackResponse, FeedbackAuditLog } from '@/types/feedback';
import {
  getResponses,
  getAuditLogs,
  pauseCampaign,
  publishCampaign,
  archiveCampaign,
  duplicateCampaign,
} from '@/services/feedbackService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { FeedbackPreviewModal } from './FeedbackPreviewModal';
import {
  ArrowLeft,
  Edit,
  Eye,
  Pause,
  Play,
  Archive,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  History,
} from 'lucide-react';

interface CampaignDetailProps {
  campaign: FeedbackCampaign;
  onBack: () => void;
  onEdit: (campaign: FeedbackCampaign) => void;
  onRefresh: () => void;
  onTestOnMyself?: (campaign: FeedbackCampaign) => void;
}

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaign,
  onBack,
  onEdit,
  onRefresh,
  onTestOnMyself,
}) => {
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [auditLogs, setAuditLogs] = useState<FeedbackAuditLog[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [respData, auditData] = await Promise.all([
          getResponses({ campaignId: campaign.id }),
          getAuditLogs(campaign.id),
        ]);
        setResponses(respData);
        setAuditLogs(auditData);
      } catch {
      }
    };
    loadData();
  }, [campaign.id]);

  const activeVersion =
    campaign.versions?.find((v) => v.id === campaign.current_version_id) ||
    campaign.versions?.[0];

  const totalResponses = responses.length;
  const positiveCount = responses.filter((r) => r.rating === 'positive').length;
  const negativeCount = responses.filter((r) => r.rating === 'negative').length;
  const satisfactionRate = totalResponses > 0 ? Math.round((positiveCount / totalResponses) * 100) : 0;

  const handleTogglePause = async () => {
    setActionLoading(true);
    try {
      if (campaign.status === 'active') {
        await pauseCampaign(campaign.id);
      } else if (campaign.status === 'paused' || campaign.status === 'draft') {
        await publishCampaign(campaign.id);
      }
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    try {
      await archiveCampaign(campaign.id, 'Admin', archiveReason);
      setShowArchiveConfirm(false);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setActionLoading(true);
    try {
      await duplicateCampaign(campaign.id);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const previewConfig = activeVersion?.configuration || {
    positive_label: 'Yes',
    negative_label: 'No',
    negative_reasons: [],
    comment_enabled: true,
  };

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in-50 duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Campaigns</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{campaign.name}</h1>
              <Badge
                variant="outline"
                className={`text-xs font-semibold capitalize ${
                  campaign.status === 'active'
                    ? 'border-success/30 bg-success/10 text-success'
                    : campaign.status === 'paused'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : campaign.status === 'archived'
                    ? 'border-muted text-muted-foreground bg-muted/40'
                    : 'border-border text-foreground bg-muted/20'
                }`}
              >
                {campaign.status}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {activeVersion ? activeVersion.version_label : `v${campaign.current_version_number}`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{campaign.description}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </Button>

          {onTestOnMyself && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTestOnMyself(campaign)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Test on myself</span>
            </Button>
          )}

          {campaign.status !== 'archived' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(campaign)}
              className="gap-1.5"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Button>
          )}

          {campaign.status !== 'archived' && (
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={handleTogglePause}
              className="gap-1.5"
            >
              {campaign.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4 text-amber-500" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 text-success" />
                  <span>Activate</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading}
            onClick={handleDuplicate}
            className="gap-1.5"
          >
            <Copy className="h-4 w-4" />
            <span>Duplicate</span>
          </Button>

          {campaign.status !== 'archived' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchiveConfirm(true)}
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Archive className="h-4 w-4" />
              <span>Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Total Responses</span>
          <p className="text-2xl font-bold tabular-nums text-foreground">{totalResponses}</p>
          <span className="text-[11px] text-muted-foreground">All versions</span>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Positive (Yes)</span>
            <ThumbsUp className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-success">{positiveCount}</p>
          <span className="text-[11px] text-muted-foreground">Useful results</span>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Negative (No)</span>
            <ThumbsDown className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-destructive">{negativeCount}</p>
          <span className="text-[11px] text-muted-foreground">With improvement reasons</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Helpfulness Rate</span>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {totalResponses > 0 ? `${satisfactionRate}%` : '—'}
          </p>
          <span className="text-[11px] text-muted-foreground">Positive ratio</span>
        </Card>
      </div>

      {/* Campaign Configuration Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 md:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Active Experience Specification
          </h2>

          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Question Shown to Analysts</span>
            <p className="text-base font-semibold text-foreground">
              "{activeVersion?.question || 'Was this result useful?'}"
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">
                {activeVersion ? activeVersion.version_label : 'v1'}
              </span>
              <span>•</span>
              <span>Response Type: Yes / No</span>
              <span>•</span>
              <span>Optional Comment: {previewConfig.comment_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configured Negative Reasons ({previewConfig.negative_reasons.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {previewConfig.negative_reasons.map((r, idx) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background text-xs"
                >
                  <span className="text-muted-foreground font-mono w-4">{idx + 1}.</span>
                  <span className="text-foreground font-medium truncate">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Delivery Rules
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between pb-2 border-b border-border">
              <span className="text-muted-foreground">Trigger Event</span>
              <span className="font-medium text-foreground">Successful single-domain search</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border">
              <span className="text-muted-foreground">Audience</span>
              <span className="font-medium text-foreground capitalize">{campaign.audience}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border">
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium text-foreground">Every eligible search</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border">
              <span className="text-muted-foreground">Priority</span>
              <span className="font-medium text-foreground capitalize">{campaign.priority}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border">
              <span className="text-muted-foreground">Schedule Start</span>
              <span className="font-medium text-foreground">
                {campaign.start_at ? new Date(campaign.start_at).toLocaleDateString() : 'Immediately'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Schedule End</span>
              <span className="font-medium text-foreground">
                {campaign.end_at ? new Date(campaign.end_at).toLocaleDateString() : 'No end date'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Version History Table */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Version History
            </h2>
            <p className="text-xs text-muted-foreground">
              Every published version is preserved to maintain the integrity of historical responses.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {campaign.versions?.length || 1} version(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 font-medium">Version</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium">Question</th>
                <th className="py-2.5 font-medium">Created</th>
                <th className="py-2.5 font-medium text-right">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(campaign.versions || []).map((ver) => (
                <tr key={ver.id} className="hover:bg-muted/30">
                  <td className="py-2.5 font-mono font-semibold text-foreground">{ver.version_label}</td>
                  <td className="py-2.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${
                        ver.status === 'published'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {ver.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-foreground truncate max-w-xs">{ver.question}</td>
                  <td className="py-2.5 text-muted-foreground tabular-nums">
                    {new Date(ver.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                    {ver.published_at ? new Date(ver.published_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Trail Section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Campaign Audit Trail
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{auditLogs.length} events</span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {auditLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-border/70 bg-muted/10 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{log.actor_name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px] text-foreground">
                    {log.action}
                  </span>
                </div>
                <span className="text-muted-foreground tabular-nums text-[11px]">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Preview Modal */}
      <FeedbackPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        question={activeVersion?.question || 'Was this result useful?'}
        config={previewConfig}
      />

      {/* Archive Confirmation Modal */}
      <Dialog
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive Campaign?"
        description="Archiving stops this campaign from appearing to Analysts. Existing responses and campaign history will be safely preserved."
        size="md"
      >
        <div className="space-y-3 py-2 text-xs">
          <label className="text-xs font-medium text-foreground">Archive Reason (Optional)</label>
          <input
            type="text"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="e.g. Replaced by Q4 feedback initiative"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#A1A1A1]/80"
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowArchiveConfirm(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleArchive}
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
