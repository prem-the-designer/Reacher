import React, { useState } from 'react';
import type {
  FeedbackCampaign,
  FeedbackCampaignVersion,
  FeedbackPriority,
  NegativeReasonItem,
} from '@/types/feedback';
import {
  saveCampaignDraft,
  publishCampaign,
  createNewVersion,
  DEFAULT_NEGATIVE_REASONS,
} from '@/services/feedbackService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { FeedbackPreviewModal } from './FeedbackPreviewModal';
import {
  ArrowLeft,
  Eye,
  Send,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface CampaignEditorProps {
  campaign: FeedbackCampaign | null;
  onBack: () => void;
  onSaved: (campaign: FeedbackCampaign) => void;
  onTestOnMyself?: (campaign: FeedbackCampaign, version: FeedbackCampaignVersion) => void;
}

export const CampaignEditor: React.FC<CampaignEditorProps> = ({
  campaign,
  onBack,
  onSaved,
  onTestOnMyself,
}) => {
  const isEditing = !!campaign;
  const isPublished = campaign?.status === 'active' || campaign?.status === 'paused';

  const currentVersion =
    campaign?.versions?.find((v) => v.id === campaign.current_version_id) ||
    campaign?.versions?.[0];

  // Section A: Basic Info
  const [name, setName] = useState(campaign?.name || 'Successful Search Feedback');
  const [description, setDescription] = useState(
    campaign?.description ||
      'Collect feedback from Analysts after successful single-domain searches.'
  );

  // Section B: Feedback Content
  const [question, setQuestion] = useState(
    currentVersion?.question || 'Was this result useful?'
  );
  const [negativeReasons, setNegativeReasons] = useState<NegativeReasonItem[]>(
    currentVersion?.configuration?.negative_reasons || DEFAULT_NEGATIVE_REASONS
  );
  const [newReasonText, setNewReasonText] = useState('');
  const [commentEnabled, setCommentEnabled] = useState(
    currentVersion?.configuration?.comment_enabled ?? true
  );
  const commentPlaceholder =
    currentVersion?.configuration?.comment_placeholder || 'Tell us more (optional)';

  // Section C: Trigger (V1 defaults)
  // Section D: Audience (Analysts)
  // Section E: Frequency (Every eligible search)

  // Section F: Schedule
  const [hasStartDate, setHasStartDate] = useState(!!campaign?.start_at);
  const [startDate, setStartDate] = useState(
    campaign?.start_at ? campaign.start_at.slice(0, 10) : ''
  );
  const [hasEndDate, setHasEndDate] = useState(!!campaign?.end_at);
  const [endDate, setEndDate] = useState(
    campaign?.end_at ? campaign.end_at.slice(0, 10) : ''
  );

  // Section G: Priority
  const [priority, setPriority] = useState<FeedbackPriority>(campaign?.priority || 'normal');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Reordering Negative Reasons
  const handleMoveReason = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= negativeReasons.length) return;
    const updated = [...negativeReasons];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setNegativeReasons(updated.map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  const handleRemoveReason = (id: string) => {
    if (negativeReasons.length <= 1) {
      setError('At least one negative feedback reason is required.');
      return;
    }
    setError(null);
    setNegativeReasons(negativeReasons.filter((r) => r.id !== id));
  };

  const handleAddReason = () => {
    if (!newReasonText.trim()) return;
    const newItem: NegativeReasonItem = {
      id: `reason-${Date.now()}`,
      label: newReasonText.trim(),
      order: negativeReasons.length + 1,
    };
    setNegativeReasons([...negativeReasons, newItem]);
    setNewReasonText('');
    setError(null);
  };

  const getActiveVersionPayload = (): Partial<FeedbackCampaignVersion> => ({
    question,
    response_type: 'yes_no',
    configuration: {
      positive_label: 'Yes',
      negative_label: 'No',
      negative_reasons: negativeReasons,
      comment_enabled: commentEnabled,
      comment_placeholder: commentPlaceholder,
      comment_max_length: 500,
    },
  });

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }
    if (negativeReasons.length === 0) {
      setError('At least one negative feedback reason must be configured.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await saveCampaignDraft(
        {
          id: campaign?.id,
          name: name.trim(),
          description: description.trim(),
          priority,
          start_at: hasStartDate && startDate ? new Date(startDate).toISOString() : null,
          end_at: hasEndDate && endDate ? new Date(endDate).toISOString() : null,
        },
        getActiveVersionPayload()
      );
      setSuccessMsg('Campaign draft saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishClick = () => {
    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }
    if (negativeReasons.length === 0) {
      setError('At least one negative feedback reason must be configured.');
      return;
    }
    setError(null);
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async () => {
    setSaving(true);
    setError(null);
    try {
      let savedCamp: FeedbackCampaign;
      if (isPublished) {
        // Create new version for already published campaign to preserve history
        savedCamp = await createNewVersion(campaign!.id, getActiveVersionPayload());
        savedCamp = await publishCampaign(savedCamp.id);
      } else {
        // Save first then publish
        savedCamp = await saveCampaignDraft(
          {
            id: campaign?.id,
            name: name.trim(),
            description: description.trim(),
            priority,
            start_at: hasStartDate && startDate ? new Date(startDate).toISOString() : null,
            end_at: hasEndDate && endDate ? new Date(endDate).toISOString() : null,
          },
          getActiveVersionPayload()
        );
        savedCamp = await publishCampaign(savedCamp.id);
      }
      setShowPublishModal(false);
      onSaved(savedCamp);
    } catch (e: any) {
      setError(e.message || 'Failed to publish campaign.');
    } finally {
      setSaving(false);
    }
  };

  const previewConfig = {
    positive_label: 'Yes',
    negative_label: 'No',
    negative_reasons: negativeReasons,
    comment_enabled: commentEnabled,
    comment_placeholder: commentPlaceholder,
    comment_max_length: 500,
  };

  const currentVersionLabel = isPublished
    ? `v${(campaign?.current_version_number || 1) + 1} (Draft)`
    : `v${campaign?.current_version_number || 1}`;

  return (
    <div className="space-y-8 max-w-5xl pb-16 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Campaigns</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isEditing ? 'Configure Feedback Campaign' : 'Create Feedback Campaign'}
          </h1>
          <Badge variant="outline" className="font-mono text-xs">
            {currentVersionLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </Button>
          {onTestOnMyself && campaign && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onTestOnMyself(campaign, {
                  id: 'test-version',
                  campaign_id: campaign.id,
                  version_number: campaign.current_version_number || 1,
                  version_label: `v${campaign.current_version_number || 1}`,
                  question,
                  response_type: 'yes_no',
                  configuration: previewConfig,
                  status: 'draft',
                  created_by: 'admin',
                  created_at: new Date().toISOString(),
                  published_at: null,
                })
              }
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Test on myself</span>
            </Button>
          )}
        </div>
      </div>

      {isPublished && (
        <Alert variant="default" title="Versioning Policy Active">
          <p className="text-xs text-muted-foreground">
            This campaign is currently published. Editing and publishing will automatically create a new
            version (<strong>v{(campaign?.current_version_number || 1) + 1}</strong>) to protect historical
            responses and ensure strict auditability.
          </p>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" title="Configuration Error">
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/10 text-success text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SECTION A — Basic Information */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Section A — Basic Information</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify the campaign and explain its objective to fellow administrators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Campaign Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Successful Search Feedback"
              className="text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Feedback Type</label>
            <div className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-muted/30 text-xs">
              <span className="font-medium text-foreground">Successful Search Feedback</span>
              <Badge variant="secondary" className="text-[10px]">
                V1 Core
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Collect feedback from Analysts after successful single-domain searches."
              className="text-xs"
            />
          </div>
        </div>
      </Card>

      {/* SECTION B — Feedback Content */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Section B — Feedback Content</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define the exact question and follow-up choices presented to the Analyst.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Feedback Question <span className="text-destructive">*</span>
            </label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Was this result useful?"
              className="text-sm font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Response Type</label>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Yes / No binary rating</span>
            </div>
          </div>
        </div>

        {/* Negative Feedback Reasons Builder */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Negative Feedback Reasons ("What could be improved?")
              </h3>
              <p className="text-xs text-muted-foreground">
                Analysts can select multiple reasons if they answer "No". At least one reason is required.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {negativeReasons.length} configured
            </span>
          </div>

          <div className="space-y-2">
            {negativeReasons.map((reason, idx) => (
              <div
                key={reason.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/10 text-xs hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-muted-foreground font-mono w-5 shrink-0 text-center">
                    {idx + 1}.
                  </span>
                  <span className="text-foreground font-medium truncate">{reason.label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => handleMoveReason(idx, 'up')}
                    className="h-7 w-7 p-0"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx === negativeReasons.length - 1}
                    onClick={() => handleMoveReason(idx, 'down')}
                    className="h-7 w-7 p-0"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveReason(reason.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    title="Remove reason"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Reason input */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newReasonText}
              onChange={(e) => setNewReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddReason();
                }
              }}
              placeholder="Type a new negative reason and press Add..."
              className="text-xs flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddReason}
              disabled={!newReasonText.trim()}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Reason</span>
            </Button>
          </div>
        </div>

        {/* Comment Settings */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-xs font-semibold text-foreground">Allow Optional Analyst Comment</label>
            <p className="text-xs text-muted-foreground">
              Includes an optional free-text box for qualitative feedback.
            </p>
          </div>
          <input
            type="checkbox"
            checked={commentEnabled}
            onChange={(e) => setCommentEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
          />
        </div>
      </Card>

      {/* SECTION C — Trigger & Conditions */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Section C — Trigger & Conditions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defines the exact event that makes an Analyst eligible for feedback.
          </p>
        </div>

        {/* Visual Pipeline */}
        <div className="p-4 rounded-xl border border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Search Completed</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Successful</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border">
              <span>Single Domain</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border">
              <span>Result Available</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Feedback Eligible</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="rounded-lg border border-success/20 bg-success/5 p-3 space-y-1">
            <span className="font-semibold text-success flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Eligible Trigger Scenarios
            </span>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
              <li>Single domain search successfully completed</li>
              <li>Reach value is present in database</li>
              <li>Analyst has access to result</li>
            </ul>
          </div>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1">
            <span className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Excluded Scenarios (No Feedback)
            </span>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
              <li>Invalid domains or domain not found</li>
              <li>API failures, rate-limits or fallback fetch</li>
              <li>Data refresh or bulk domain imports</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* SECTIONS D, E, F, G — Audience, Frequency, Schedule, Priority */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Sections D & E — Audience & Frequency
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure delivery target and display pacing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Target Audience</label>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
              <span className="font-medium text-foreground">Analysts</span>
              <Badge variant="outline" className="text-[10px]">
                Role-based
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Frequency Rule</label>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
              <span className="font-medium text-foreground">Every eligible search</span>
              <Badge variant="secondary" className="text-[10px]">
                Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Schedule & Priority */}
        <div className="pt-4 border-t border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Sections F & G — Schedule & Priority</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Start Date</label>
                <button
                  type="button"
                  onClick={() => setHasStartDate(!hasStartDate)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {hasStartDate ? 'Immediate' : 'Specify Date'}
                </button>
              </div>
              {hasStartDate ? (
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs"
                />
              ) : (
                <div className="p-2 rounded-md border border-border bg-muted/20 text-xs text-muted-foreground">
                  Starts immediately
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">End Date</label>
                <button
                  type="button"
                  onClick={() => setHasEndDate(!hasEndDate)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {hasEndDate ? 'No End Date' : 'Specify Date'}
                </button>
              </div>
              {hasEndDate ? (
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs"
                />
              ) : (
                <div className="p-2 rounded-md border border-border bg-muted/20 text-xs text-muted-foreground">
                  No end date
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Campaign Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#A1A1A1]/80"
              >
                <option value="low">Low Priority</option>
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 z-20 flex items-center justify-between p-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Cancel
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>Save Draft</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handlePublishClick}
            disabled={saving}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            <Send className="h-4 w-4" />
            <span>Publish Campaign</span>
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      <FeedbackPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        question={question}
        config={previewConfig}
      />

      {/* Publish Confirmation Summary Modal */}
      <Dialog
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="Publish Feedback Campaign?"
        description="Please review the campaign specifications before making it live to Analysts."
        size="md"
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campaign:</span>
              <span className="font-semibold text-foreground">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Version:</span>
              <span className="font-mono font-medium text-foreground">{currentVersionLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audience:</span>
              <span className="font-medium text-foreground">Analysts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trigger:</span>
              <span className="font-medium text-foreground">Successful single-domain search</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency:</span>
              <span className="font-medium text-foreground">Every eligible search</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status after publish:</span>
              <Badge variant="outline" className="text-success border-success/30 bg-success/10 text-[10px]">
                Active
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowPublishModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirmPublish}
            disabled={saving}
            className="bg-primary text-primary-foreground"
          >
            {saving ? 'Publishing...' : 'Publish Campaign'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
