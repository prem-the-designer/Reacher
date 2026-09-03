import React, { useState, useMemo } from 'react';
import type {
  FeedbackCampaign,
  FeedbackCampaignVersion,
  FeedbackPriority,
  NegativeReasonItem,
  CampaignCondition,
  CampaignExclusion,
  ConditionField,
} from '@/types/feedback';
import {
  saveCampaignDraft,
  publishCampaign,
  createNewVersion,
  DEFAULT_NEGATIVE_REASONS,
  DEFAULT_CONDITIONS,
  DEFAULT_EXCLUSIONS,
  testCampaignEligibility,
  ScenarioParams,
  ScenarioResult,
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
  Check,
  X,
  Filter,
  Calendar,
  Users,
  Sliders,
  Activity,
  Info,
} from 'lucide-react';

interface CampaignEditorProps {
  campaign: FeedbackCampaign | null;
  onBack: () => void;
  onSaved: (campaign: FeedbackCampaign) => void;
  onTestOnMyself?: (campaign: FeedbackCampaign, version: FeedbackCampaignVersion) => void;
}

const FIELD_OPTIONS: { field: ConditionField; label: string; values: { val: string; label: string }[] }[] = [
  {
    field: 'search_type',
    label: 'Search Type',
    values: [
      { val: 'single_domain', label: 'Single Domain' },
      { val: 'bulk_search', label: 'Bulk Search' },
    ],
  },
  {
    field: 'search_status',
    label: 'Search Status',
    values: [
      { val: 'successful', label: 'Successful' },
      { val: 'failed', label: 'Failed' },
    ],
  },
  {
    field: 'reach_value',
    label: 'Reach Value',
    values: [
      { val: 'available', label: 'Available' },
      { val: 'not_available', label: 'Not Available' },
    ],
  },
  {
    field: 'search_source',
    label: 'Search Source',
    values: [
      { val: 'existing_data', label: 'Existing Data' },
      { val: 'api', label: 'API' },
    ],
  },
];

export const CampaignEditor: React.FC<CampaignEditorProps> = ({
  campaign,
  onBack,
  onSaved,
}) => {
  const isEditing = !!campaign;
  const isPublished = campaign?.status === 'active' || campaign?.status === 'paused';

  const currentVersion =
    campaign?.versions?.find((v) => v.id === campaign.current_version_id) ||
    campaign?.versions?.[0];

  // ── Step 1: Basic Information ──────────────────────────────────────────────
  const [name, setName] = useState(campaign?.name || 'Successful Search Feedback');
  const [description, setDescription] = useState(
    campaign?.description || 'Collect feedback from Analysts after successful single-domain searches.'
  );

  // ── Step 2: Feedback Content ───────────────────────────────────────────────
  const [question, setQuestion] = useState(currentVersion?.question || 'Was this result useful?');
  const [negativeReasons, setNegativeReasons] = useState<NegativeReasonItem[]>(
    currentVersion?.configuration?.negative_reasons || DEFAULT_NEGATIVE_REASONS
  );
  const [newReasonText, setNewReasonText] = useState('');
  const [commentEnabled, setCommentEnabled] = useState(
    currentVersion?.configuration?.comment_enabled ?? true
  );

  // ── Step 3: Trigger & Conditions ───────────────────────────────────────────
  const [conditions, setConditions] = useState<CampaignCondition[]>(
    campaign?.conditions || currentVersion?.conditions || DEFAULT_CONDITIONS
  );
  const [exclusions, setExclusions] = useState<CampaignExclusion[]>(
    campaign?.exclusions || currentVersion?.exclusions || DEFAULT_EXCLUSIONS
  );

  // ── Step 4: Schedule & Frequency ───────────────────────────────────────────
  const [startType, setStartType] = useState<'immediate' | 'scheduled'>(
    campaign?.start_at ? 'scheduled' : 'immediate'
  );
  const [startDate, setStartDate] = useState(
    campaign?.start_at ? campaign.start_at.slice(0, 16) : ''
  );
  const [endType, setEndType] = useState<'none' | 'scheduled'>(
    campaign?.end_at ? 'scheduled' : 'none'
  );
  const [endDate, setEndDate] = useState(
    campaign?.end_at ? campaign.end_at.slice(0, 16) : ''
  );
  const [cooldownHours, setCooldownHours] = useState<number>(
    campaign?.cooldown_seconds ? Math.round(campaign.cooldown_seconds / 3600) : 24
  );
  const [maxPromptsPerDay, setMaxPromptsPerDay] = useState<number>(
    campaign?.max_prompts_per_day ?? 3
  );

  // ── Step 5: Audience (Analysts) ───────────────────────────────────────────
  // Default V1 audience is analysts

  // ── Step 6: Priority ───────────────────────────────────────────────────────
  const [priority, setPriority] = useState<FeedbackPriority>(campaign?.priority || 'normal');

  // ── Step 7: Preview & Scenario Simulator ───────────────────────────────────
  const [activeStep7Tab, setActiveStep7Tab] = useState<'preview' | 'test'>('preview');
  const [previewState, setPreviewState] = useState<'prompt' | 'negative' | 'submitted'>('prompt');
  const [previewSelectedReasons, setPreviewSelectedReasons] = useState<string[]>([]);
  const [previewComment, setPreviewComment] = useState('');

  // Scenario Simulator
  const [simScenario, setSimScenario] = useState<ScenarioParams>({
    searchType: 'single_domain',
    searchStatus: 'successful',
    reachValue: 'available',
    searchSource: 'existing_data',
    userRole: 'analyst',
  });
  const [simResult, setSimResult] = useState<ScenarioResult | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // ── Validation Calculations ────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!name.trim()) {
      errors.push('Campaign name is required.');
    } else if (name.trim().length < 3) {
      errors.push('Campaign name must be at least 3 characters.');
    } else if (name.trim().length > 100) {
      errors.push('Campaign name cannot exceed 100 characters.');
    }

    if (negativeReasons.length === 0) {
      errors.push('At least one negative feedback reason is required.');
    }

    if (startType === 'scheduled' && !startDate) {
      errors.push('Scheduled start date & time is required.');
    }

    if (endType === 'scheduled') {
      if (!endDate) {
        errors.push('Scheduled end date & time is required.');
      } else if (startType === 'scheduled' && startDate && new Date(endDate) <= new Date(startDate)) {
        errors.push('End date must be after the start date.');
      }
    }

    if (conditions.length === 0) {
      errors.push('At least one trigger condition must be configured.');
    }

    return errors;
  }, [name, negativeReasons, startType, startDate, endType, endDate, conditions]);

  const isReadyToPublish = validationErrors.length === 0;

  // ── Human-Readable Trigger Summary Generation ─────────────────────────────
  const humanReadableSummary = useMemo(() => {
    const condParts: string[] = [];
    for (const c of conditions) {
      if (c.field === 'search_type') {
        condParts.push(c.value === 'single_domain' ? 'single-domain search' : 'bulk search');
      } else if (c.field === 'search_status') {
        condParts.push(c.value === 'successful' ? 'successful' : 'failed');
      } else if (c.field === 'reach_value') {
        condParts.push(c.value === 'available' ? 'with a Reach Value available' : 'without a Reach Value');
      }
    }

    const enabledExclusions = exclusions.filter((e) => e.enabled).map((e) => e.label.toLowerCase());
    const exclText = enabledExclusions.length > 0
      ? ` It will not appear for ${enabledExclusions.join(', ')}.`
      : '';

    const cooldownText = cooldownHours > 0
      ? `It can appear once every ${cooldownHours} hour${cooldownHours > 1 ? 's' : ''}`
      : 'It can appear on every eligible search';

    const limitText = maxPromptsPerDay > 0
      ? `, with a maximum of ${maxPromptsPerDay} prompt${maxPromptsPerDay > 1 ? 's' : ''} per Analyst per day.`
      : '.';

    return `This campaign will show to Analysts after a ${condParts.join(' ')} is completed.${exclText} ${cooldownText}${limitText}`;
  }, [conditions, exclusions, cooldownHours, maxPromptsPerDay]);

  // ── Reason Item Handlers ───────────────────────────────────────────────────
  const handleAddReason = () => {
    if (!newReasonText.trim()) return;
    const newReason: NegativeReasonItem = {
      id: `reason-${Date.now()}`,
      label: newReasonText.trim(),
      order: negativeReasons.length + 1,
    };
    setNegativeReasons([...negativeReasons, newReason]);
    setNewReasonText('');
  };

  const handleEditReason = (id: string, text: string) => {
    setNegativeReasons(
      negativeReasons.map((r) => (r.id === id ? { ...r, label: text } : r))
    );
  };

  const handleDeleteReason = (id: string) => {
    setNegativeReasons(negativeReasons.filter((r) => r.id !== id));
  };

  const handleMoveReason = (index: number, direction: 'up' | 'down') => {
    const next = [...negativeReasons];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    next.forEach((item, idx) => {
      item.order = idx + 1;
    });
    setNegativeReasons(next);
  };

  // ── Condition Handlers ─────────────────────────────────────────────────────
  const handleAddCondition = () => {
    const newCond: CampaignCondition = {
      id: `cond-${Date.now()}`,
      field: 'search_source',
      operator: 'is',
      value: 'existing_data',
    };
    setConditions([...conditions, newCond]);
  };

  const handleUpdateConditionField = (id: string, field: ConditionField) => {
    const fieldDef = FIELD_OPTIONS.find((f) => f.field === field);
    const defaultValue = fieldDef?.values[0]?.val || '';
    setConditions(
      conditions.map((c) =>
        c.id === id ? { ...c, field, value: defaultValue } : c
      )
    );
  };

  const handleUpdateConditionValue = (id: string, value: string) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, value } : c))
    );
  };

  const handleDeleteCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  // ── Exclusion Handlers ────────────────────────────────────────────────────
  const handleToggleExclusion = (id: string) => {
    setExclusions(
      exclusions.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  // ── Scenario Simulator Check ───────────────────────────────────────────────
  const handleRunSimulation = () => {
    const simulatedCampaign: Partial<FeedbackCampaign> = {
      conditions,
      exclusions,
      start_at: startType === 'scheduled' && startDate ? new Date(startDate).toISOString() : null,
      end_at: endType === 'scheduled' && endDate ? new Date(endDate).toISOString() : null,
    };
    const res = testCampaignEligibility(simulatedCampaign, simScenario);
    setSimResult(res);
  };

  // ── Save Draft Action ─────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: Partial<FeedbackCampaign> = {
        ...(campaign || {}),
        name: name.trim() || 'Untitled Feedback Campaign',
        description: description.trim(),
        priority,
        priority_score: priority === 'high' ? 100 : priority === 'normal' ? 50 : 10,
        conditions,
        exclusions,
        cooldown_seconds: cooldownHours * 3600,
        max_prompts_per_day: maxPromptsPerDay,
        start_at: startType === 'scheduled' && startDate ? new Date(startDate).toISOString() : null,
        end_at: endType === 'scheduled' && endDate ? new Date(endDate).toISOString() : null,
      };

      const versionPayload: Partial<FeedbackCampaignVersion> = {
        question: question.trim(),
        configuration: {
          positive_label: 'Yes',
          negative_label: 'No',
          negative_reasons: negativeReasons,
          comment_enabled: commentEnabled,
          comment_placeholder: 'Tell us more (optional)',
          comment_max_length: 500,
        },
        conditions,
        exclusions,
      };

      // Non-destructive versioning if campaign is already published
      if (isPublished && campaign?.id) {
        const updated = await createNewVersion(campaign.id, versionPayload);
        setSuccessMsg(`New Draft Version (v${updated.current_version_number}) created successfully!`);
        setTimeout(() => onSaved(updated), 800);
      } else {
        const saved = await saveCampaignDraft(payload, versionPayload);
        setSuccessMsg('Campaign draft saved successfully.');
        setTimeout(() => onSaved(saved), 800);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save campaign draft.');
    } finally {
      setSaving(false);
    }
  };

  // ── Publish Action ─────────────────────────────────────────────────────────
  const handlePublishConfirm = async () => {
    if (!isReadyToPublish) return;
    setSaving(true);
    setError(null);
    setShowPublishModal(false);

    try {
      const payload: Partial<FeedbackCampaign> = {
        ...(campaign || {}),
        name: name.trim(),
        description: description.trim(),
        priority,
        priority_score: priority === 'high' ? 100 : priority === 'normal' ? 50 : 10,
        conditions,
        exclusions,
        cooldown_seconds: cooldownHours * 3600,
        max_prompts_per_day: maxPromptsPerDay,
        start_at: startType === 'scheduled' && startDate ? new Date(startDate).toISOString() : null,
        end_at: endType === 'scheduled' && endDate ? new Date(endDate).toISOString() : null,
      };

      const versionPayload: Partial<FeedbackCampaignVersion> = {
        question: question.trim(),
        configuration: {
          positive_label: 'Yes',
          negative_label: 'No',
          negative_reasons: negativeReasons,
          comment_enabled: commentEnabled,
          comment_placeholder: 'Tell us more (optional)',
          comment_max_length: 500,
        },
        conditions,
        exclusions,
      };

      // Save draft first to update records
      const saved = await saveCampaignDraft(payload, versionPayload);
      // Then publish
      const published = await publishCampaign(saved.id);
      setSuccessMsg('Feedback campaign published successfully!');
      setTimeout(() => onSaved(published), 800);
    } catch (err: any) {
      setError(err?.message || 'Failed to publish campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in-50 duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Campaigns</span>
            </button>
            <span>/</span>
            <span className="text-foreground font-medium">
              {isEditing ? `Edit Campaign (${campaign?.name})` : 'Create Campaign'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Edit Feedback Campaign' : 'Create Feedback Campaign'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure when and where this feedback experience should appear to Analysts.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 sm:flex-none border-border"
          >
            <Save className="h-4 w-4 mr-1.5" />
            <span>Save Draft</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreviewModal(true)}
            className="flex-1 sm:flex-none border-border"
          >
            <Eye className="h-4 w-4 mr-1.5 text-primary" />
            <span>Preview</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowPublishModal(true)}
            disabled={saving || !isReadyToPublish}
            className="flex-1 sm:flex-none bg-primary text-primary-foreground"
          >
            <Send className="h-4 w-4 mr-1.5" />
            <span>Publish Campaign</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <Alert variant="destructive" title="Error">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs hover:opacity-80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </Alert>
      )}
      {successMsg && (
        <Alert variant="default" className="border-success/40 bg-success/10 text-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground">{successMsg}</span>
          </div>
        </Alert>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 7 Configuration Steps (cols 1-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ── STEP 1: Basic Information ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                <p className="text-xs text-muted-foreground">General identification and feedback scope.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Campaign name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Successful Search Feedback"
                  maxLength={100}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>Minimum 3 characters</span>
                  <span>{name.length} / 100</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe the goal and target workflow of this campaign..."
                  maxLength={250}
                  className="w-full resize-none rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex justify-end text-[11px] text-muted-foreground mt-1">
                  <span>{description.length} / 250</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Feedback type
                </label>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground">Successful Search Feedback</span>
                    <p className="text-[11px] text-muted-foreground">
                      Analyst searches for a single domain and retrieves a valid Reach Value.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    Active V1 Type
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>Architecture is ready for future types (API Search, Refresh, Bulk Import, NPS, CES).</span>
                </p>
              </div>
            </div>
          </Card>

          {/* ── STEP 2: Feedback Content ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Feedback Content</h3>
                <p className="text-xs text-muted-foreground">Configure the question and response options displayed to Analysts.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Question prompt <span className="text-destructive">*</span>
                </label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Was this result useful?"
                />
              </div>

              <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Response format: Yes / No</span>
                  <Badge variant="secondary" className="text-[10px]">V1 Standard</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded border border-border/60 bg-muted/10">
                    <span className="font-semibold text-success flex items-center gap-1 mb-1">
                      <Check className="h-3.5 w-3.5" /> Positive Response (Yes)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Submits positive rating and displays <em>"Thanks for your feedback."</em>
                    </p>
                  </div>
                  <div className="p-2.5 rounded border border-border/60 bg-muted/10">
                    <span className="font-semibold text-amber-500 flex items-center gap-1 mb-1">
                      <X className="h-3.5 w-3.5" /> Negative Response (No)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Displays inline follow-up: <em>"What could be improved?"</em>
                    </p>
                  </div>
                </div>
              </div>

              {/* Negative Reasons List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Negative Follow-up Reasons ({negativeReasons.length}) <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">Reorder, edit, or add reasons</span>
                </div>

                <div className="space-y-2">
                  {negativeReasons.map((reason, index) => (
                    <div
                      key={reason.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-border/80 bg-background text-xs"
                    >
                      <span className="text-muted-foreground text-[10px] w-4 text-center font-mono">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={reason.label}
                        onChange={(e) => handleEditReason(reason.id, e.target.value)}
                        className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-foreground text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveReason(index, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6"
                          title="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveReason(index, 'down')}
                          disabled={index === negativeReasons.length - 1}
                          className="h-6 w-6"
                          title="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteReason(reason.id)}
                          disabled={negativeReasons.length <= 1}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Delete reason"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Reason Input */}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newReasonText}
                    onChange={(e) => setNewReasonText(e.target.value)}
                    placeholder="Add a new negative reason..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddReason();
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddReason}
                    className="h-8 text-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    <span>Add Reason</span>
                  </Button>
                </div>
              </div>

              {/* Optional Comment Toggle */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">Allow optional comment</span>
                  <p className="text-[11px] text-muted-foreground">
                    Shows a medium-sized comment box when "Something else" is checked.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={commentEnabled}
                  onChange={(e) => setCommentEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
              </div>
            </div>
          </Card>

          {/* ── STEP 3: Trigger & Conditions ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Trigger & Conditions</h3>
                <p className="text-xs text-muted-foreground">Define what event initiates evaluation and what rules must be satisfied.</p>
              </div>
            </div>

            {/* Distinction Explainer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-primary flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> Trigger Event
                </span>
                <p className="text-[11px] text-muted-foreground">
                  The application event that makes this campaign eligible for evaluation.
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-primary flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> Conditions & Exclusions
                </span>
                <p className="text-[11px] text-muted-foreground">
                  The criteria that must be true (and not true) before the widget actually appears.
                </p>
              </div>
            </div>

            {/* Trigger Event Selection */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                When should this campaign be considered?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-lg border border-primary bg-primary/10 text-foreground font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Search Completed</span>
                  </div>
                  <Badge variant="default" className="text-[10px]">Active</Badge>
                </div>

                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 text-muted-foreground flex items-center justify-between opacity-60">
                  <span>API Search / Refresh / Bulk</span>
                  <span className="text-[10px]">Future</span>
                </div>
              </div>
            </div>

            {/* Rule Builder: Positive Conditions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Only show this feedback when...
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddCondition}
                  className="h-7 text-xs text-primary"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Add Condition</span>
                </Button>
              </div>

              <div className="space-y-2">
                {conditions.map((cond, idx) => {
                  const fieldDef = FIELD_OPTIONS.find((f) => f.field === cond.field);
                  return (
                    <div key={cond.id} className="space-y-2">
                      {idx > 0 && (
                        <div className="flex items-center justify-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                            AND
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                        {/* Field Selector */}
                        <select
                          value={cond.field}
                          onChange={(e) => handleUpdateConditionField(cond.id, e.target.value as ConditionField)}
                          className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.field} value={opt.field}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Operator */}
                        <span className="text-xs font-medium text-muted-foreground px-1">is</span>

                        {/* Value Selector */}
                        <select
                          value={cond.value}
                          onChange={(e) => handleUpdateConditionValue(cond.id, e.target.value)}
                          className="flex-1 h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {fieldDef?.values.map((v) => (
                            <option key={v.val} value={v.val}>
                              {v.label}
                            </option>
                          ))}
                        </select>

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCondition(cond.id)}
                          disabled={conditions.length <= 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exclusions Section */}
            <div className="pt-3 border-t border-border/60 space-y-3">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="text-amber-500">Don't show this feedback when...</span>
                <span className="text-[11px] text-muted-foreground font-normal">(Safeguards)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {exclusions.map((excl) => (
                  <button
                    type="button"
                    key={excl.id}
                    onClick={() => handleToggleExclusion(excl.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                      excl.enabled
                        ? 'border-amber-500/40 bg-amber-500/5 text-foreground font-medium'
                        : 'border-border/60 bg-muted/10 text-muted-foreground opacity-60'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border mt-0.5 ${
                        excl.enabled ? 'bg-amber-500 border-amber-500 text-white' : 'border-border bg-background'
                      }`}
                    >
                      {excl.enabled && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="block leading-snug">{excl.label}</span>
                      <span className="text-[10px] text-muted-foreground">Excluded</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Human-Readable Trigger Summary */}
            <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 text-xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Rule Interpretation
              </span>
              <p className="text-foreground leading-relaxed font-medium">
                {humanReadableSummary}
              </p>
            </div>
          </Card>

          {/* ── STEP 4: Schedule & Frequency ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                4
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Schedule & Frequency</h3>
                <p className="text-xs text-muted-foreground">Specify campaign duration, recurrence, and prompt spacing.</p>
              </div>
            </div>

            {/* Campaign Schedule */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Campaign Schedule</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Start Date */}
                <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
                  <span className="font-semibold text-foreground block">Start Rule</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="startType"
                      checked={startType === 'immediate'}
                      onChange={() => setStartType('immediate')}
                      className="text-primary focus:ring-primary"
                    />
                    <span>Start immediately upon publish</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="startType"
                      checked={startType === 'scheduled'}
                      onChange={() => setStartType('scheduled')}
                      className="text-primary focus:ring-primary"
                    />
                    <span>Schedule start date & time</span>
                  </label>
                  {startType === 'scheduled' && (
                    <Input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </div>

                {/* End Date */}
                <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
                  <span className="font-semibold text-foreground block">End Rule</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      checked={endType === 'none'}
                      onChange={() => setEndType('none')}
                      className="text-primary focus:ring-primary"
                    />
                    <span>No end date (continuous)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      checked={endType === 'scheduled'}
                      onChange={() => setEndType('scheduled')}
                      className="text-primary focus:ring-primary"
                    />
                    <span>Schedule end date & time</span>
                  </label>
                  {endType === 'scheduled' && (
                    <Input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Frequency & Cooldown */}
            <div className="space-y-4 pt-3 border-t border-border/60">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Frequency & System Limits</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Frequency Rule */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-semibold text-foreground block">Frequency Rule</span>
                  <span className="text-[11px] text-muted-foreground block">Every eligible search (V1)</span>
                  <Badge variant="outline" className="text-[10px] mt-1">1 prompt / search</Badge>
                </div>

                {/* Global Cooldown */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                  <span className="font-semibold text-foreground block">Minimum cooldown</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={168}
                      value={cooldownHours}
                      onChange={(e) => setCooldownHours(parseInt(e.target.value) || 0)}
                      className="h-8 text-xs w-20"
                    />
                    <span className="text-muted-foreground text-xs">hours</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Min spacing between feedback prompts across campaigns.
                  </p>
                </div>

                {/* Max Prompts Per Day */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                  <span className="font-semibold text-foreground block">Daily limit / Analyst</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxPromptsPerDay}
                      onChange={(e) => setMaxPromptsPerDay(parseInt(e.target.value) || 1)}
                      className="h-8 text-xs w-20"
                    />
                    <span className="text-muted-foreground text-xs">prompts</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Maximum prompts per user in a 24-hour day.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ── STEP 5: Audience ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                5
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Audience Targeting</h3>
                <p className="text-xs text-muted-foreground">Select user roles eligible to receive this feedback prompt.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-primary/50 bg-primary/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-semibold text-foreground">Analysts</span>
                  <p className="text-[11px] text-muted-foreground">
                    Available to users with the Analyst role searching for domains.
                  </p>
                </div>
              </div>
              <Badge variant="default" className="text-[10px]">Targeted</Badge>
            </div>
          </Card>

          {/* ── STEP 6: Priority ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                6
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Campaign Priority</h3>
                <p className="text-xs text-muted-foreground">
                  Determines which campaign is shown when multiple campaigns are eligible at the same time.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                { id: 'high', label: 'High · 100', desc: 'Evaluated first before other campaigns.' },
                { id: 'normal', label: 'Normal · 50', desc: 'Standard default priority level.' },
                { id: 'low', label: 'Low · 10', desc: 'Only shown if no higher campaign matches.' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriority(p.id as FeedbackPriority)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    priority === p.id
                      ? 'border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="block text-foreground mb-1">{p.label}</span>
                  <span className="text-[11px] text-muted-foreground font-normal leading-tight block">
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-2.5 rounded border border-border/60 bg-muted/20 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Conflict Resolution Rule:</span> Reacher never displays multiple feedback cards simultaneously. If two campaigns share equal priority, the campaign with the newer published version takes precedence.
            </div>
          </Card>

          {/* ── STEP 7: Preview & Eligibility Test ── */}
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  7
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Preview & Eligibility Test</h3>
                  <p className="text-xs text-muted-foreground">Verify what the analyst will see and test trigger eligibility.</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex rounded-md border border-border p-0.5 bg-muted/30 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveStep7Tab('preview')}
                  className={`px-3 py-1 rounded font-medium transition-all ${
                    activeStep7Tab === 'preview'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Analyst Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep7Tab('test')}
                  className={`px-3 py-1 rounded font-medium transition-all ${
                    activeStep7Tab === 'test'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Test Eligibility Scenario
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: Interactive Preview */}
            {activeStep7Tab === 'preview' && (
              <div className="space-y-4">
                {/* Realistic Mock Domain Search Result */}
                <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground font-semibold">example.com</span>
                    <span className="text-xs text-muted-foreground">Updated 03 Sep 2026</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold font-mono tracking-tight text-foreground">1,240,000</span>
                    <span className="text-xs text-muted-foreground uppercase font-medium">Reach Value</span>
                  </div>

                  {/* Feedback Widget Container */}
                  <div className="p-4 rounded-xl border border-primary/30 bg-card shadow-xs space-y-3">
                    {previewState === 'prompt' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground">{question}</h4>
                            <p className="text-[11px] text-muted-foreground">Your feedback helps improve reach accuracy.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewState('submitted')}
                            className="h-8 text-xs flex-1 sm:flex-none border-border"
                          >
                            Yes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewState('negative')}
                            className="h-8 text-xs flex-1 sm:flex-none border-border"
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    )}

                    {previewState === 'negative' && (
                      <div className="space-y-3 animate-in fade-in-50 duration-200">
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">What could be improved?</h4>
                          <p className="text-[11px] text-muted-foreground">Select all that apply.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {negativeReasons.map((reason) => {
                            const isChecked = previewSelectedReasons.includes(reason.label);
                            return (
                              <button
                                type="button"
                                key={reason.id}
                                onClick={() => {
                                  setPreviewSelectedReasons((prev) =>
                                    prev.includes(reason.label)
                                      ? prev.filter((r) => r !== reason.label)
                                      : [...prev, reason.label]
                                  );
                                }}
                                className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs text-left cursor-pointer transition-all duration-150 w-full select-none ${
                                  isChecked
                                    ? 'border-primary/70 bg-primary/10 text-foreground font-medium ring-1 ring-primary/30'
                                    : 'border-border/80 bg-background text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <div
                                  className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                    isChecked
                                      ? 'bg-primary border-primary text-primary-foreground'
                                      : 'border-muted-foreground/40 bg-background'
                                  }`}
                                >
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="flex-1 leading-snug">{reason.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {commentEnabled &&
                          previewSelectedReasons.some((r) => r.toLowerCase().trim() === 'something else') && (
                            <div className="space-y-1 animate-in fade-in-50 duration-200">
                              <label className="text-[11px] font-medium text-foreground">Please tell us more:</label>
                              <textarea
                                rows={3}
                                value={previewComment}
                                onChange={(e) => setPreviewComment(e.target.value)}
                                placeholder="Tell us what could be improved..."
                                className="w-full h-20 resize-none rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewState('prompt');
                              setPreviewSelectedReasons([]);
                              setPreviewComment('');
                            }}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setPreviewState('submitted')}
                            className="h-7 px-3 text-xs bg-primary text-primary-foreground"
                          >
                            Submit Feedback
                          </Button>
                        </div>
                      </div>
                    )}

                    {previewState === 'submitted' && (
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-success font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Thanks for your feedback.</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPreviewState('prompt');
                            setPreviewSelectedReasons([]);
                            setPreviewComment('');
                          }}
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Reset Preview
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Test Eligibility Simulator */}
            {activeStep7Tab === 'test' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                      <span>Simulate Search Scenario</span>
                    </span>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleRunSimulation}
                      className="h-7 text-xs bg-primary text-primary-foreground"
                    >
                      Check Eligibility
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Search Type</label>
                      <select
                        value={simScenario.searchType}
                        onChange={(e) =>
                          setSimScenario({ ...simScenario, searchType: e.target.value as any })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="single_domain">Single Domain</option>
                        <option value="bulk_search">Bulk Search</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Search Status</label>
                      <select
                        value={simScenario.searchStatus}
                        onChange={(e) =>
                          setSimScenario({ ...simScenario, searchStatus: e.target.value as any })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="successful">Successful</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Reach Value</label>
                      <select
                        value={simScenario.reachValue}
                        onChange={(e) =>
                          setSimScenario({ ...simScenario, reachValue: e.target.value as any })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="available">Available</option>
                        <option value="not_available">Not Available</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Search Source</label>
                      <select
                        value={simScenario.searchSource}
                        onChange={(e) =>
                          setSimScenario({ ...simScenario, searchSource: e.target.value as any })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="existing_data">Existing Data</option>
                        <option value="api">API</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">User Role</label>
                      <select
                        value={simScenario.userRole}
                        onChange={(e) =>
                          setSimScenario({ ...simScenario, userRole: e.target.value as any })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="analyst">Analyst</option>
                        <option value="admin">Admin</option>
                        <option value="guest">Guest</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Simulation Result Output */}
                {simResult && (
                  <div
                    className={`p-4 rounded-lg border text-xs space-y-3 animate-in fade-in-50 duration-200 ${
                      simResult.eligible
                        ? 'border-success/40 bg-success/5'
                        : 'border-destructive/40 bg-destructive/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {simResult.eligible ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <div>
                            <h4 className="font-bold text-success text-sm">Campaign Eligible</h4>
                            <p className="text-[11px] text-muted-foreground">
                              This campaign would be eligible to appear for this scenario.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <div>
                            <h4 className="font-bold text-destructive text-sm">Campaign Not Eligible</h4>
                            <p className="text-[11px] text-muted-foreground">
                              Failed condition: <span className="font-semibold text-foreground">{simResult.failedReason}</span>
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Evaluated Rules Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/60">
                      {simResult.evaluations.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2 text-[11px]">
                          {ev.passed ? (
                            <Check className="h-3.5 w-3.5 text-success stroke-[3]" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-destructive stroke-[3]" />
                          )}
                          <span
                            className={ev.passed ? 'text-foreground' : 'text-destructive font-medium'}
                          >
                            {ev.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Sticky Live Campaign Summary (cols 9-12) */}
        <div className="lg:col-span-4 sticky top-6 space-y-4">
          <Card className="p-5 border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Campaign Summary
              </span>
              {isReadyToPublish ? (
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 flex items-center gap-1">
                  <Check className="h-3 w-3 stroke-[3]" />
                  <span>Ready to publish</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                  {validationErrors.length} {validationErrors.length === 1 ? 'item needs' : 'items need'} attention
                </Badge>
              )}
            </div>

            {/* Validation Checklist if issues exist */}
            {!isReadyToPublish && (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-[11px] space-y-1">
                <span className="font-semibold text-amber-600 dark:text-amber-400 block">Required before publish:</span>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Dimension Breakdown */}
            <div className="space-y-2 text-xs divide-y divide-border/60">
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">
                  {isPublished ? 'Active' : startType === 'scheduled' ? 'Scheduled' : 'Draft'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Audience</span>
                <span className="font-medium text-foreground">Analysts</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Trigger</span>
                <span className="font-medium text-foreground">Search Completed</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Conditions</span>
                <span className="font-medium text-foreground">{conditions.length} configured</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-medium text-foreground">
                  {startType === 'scheduled' ? 'Scheduled' : 'Immediately'} → {endType === 'scheduled' ? 'Scheduled end' : 'No end date'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-medium text-foreground">Every eligible search</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Cooldown</span>
                <span className="font-medium text-foreground">{cooldownHours} hours</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Daily Limit</span>
                <span className="font-medium text-foreground">{maxPromptsPerDay} prompts / user</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-medium text-foreground capitalize">
                  {priority} · {priority === 'high' ? '100' : priority === 'normal' ? '50' : '10'}
                </span>
              </div>
            </div>

            {/* Live Narrative Summary */}
            <div className="p-3 rounded-lg border border-border/70 bg-muted/20 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block mb-0.5">Live Narrative</span>
              {humanReadableSummary}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 space-y-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowPublishModal(true)}
                disabled={saving || !isReadyToPublish}
                className="w-full bg-primary text-primary-foreground font-semibold"
              >
                <Send className="h-4 w-4 mr-1.5" />
                <span>Publish Campaign</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving}
                className="w-full border-border"
              >
                <Save className="h-4 w-4 mr-1.5" />
                <span>Save Draft</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Publish Confirmation Modal ── */}
      <Dialog
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="Publish Feedback Campaign?"
      >
        <div className="space-y-4 py-1 text-xs">
          <p className="text-muted-foreground">
            Once published, this campaign will begin appearing to eligible Analysts in accordance with the configured rules.
          </p>

          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Campaign</span>
              <span className="font-semibold text-foreground">{name}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Audience</span>
              <span className="font-semibold text-foreground">Analysts</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Trigger</span>
              <span className="font-semibold text-foreground">Search Completed</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Conditions</span>
              <span className="font-semibold text-foreground">{conditions.length} Rules Active</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Schedule</span>
              <span className="font-semibold text-foreground">
                {startType === 'scheduled' ? 'Scheduled Start' : 'Immediately'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Priority</span>
              <span className="font-semibold text-foreground capitalize">{priority}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPublishModal(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePublishConfirm}
            disabled={saving}
            className="bg-primary text-primary-foreground font-semibold"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            <span>Publish Campaign</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Modal Preview ── */}
      <FeedbackPreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        question={question}
        config={{
          positive_label: 'Yes',
          negative_label: 'No',
          negative_reasons: negativeReasons,
          comment_enabled: commentEnabled,
          comment_placeholder: 'Tell us more (optional)',
          comment_max_length: 500,
        }}
      />
    </div>
  );
};
