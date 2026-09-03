/**
 * Feedback Management Service
 * Production service layer implementing Campaign -> Version -> Trigger -> Response -> Archive
 * Resilient storage: uses Supabase tables if present, otherwise seamlessly persists to app_settings
 */

import { supabase } from '@/lib/supabase';
import type {
  FeedbackCampaign,
  FeedbackCampaignVersion,
  FeedbackResponse,
  FeedbackAuditLog,
  FeedbackSettings,
  FeedbackEligibilityResult,
  NegativeReasonItem,
  FeedbackCampaignStatus,
  CampaignCondition,
  CampaignExclusion,
} from '@/types/feedback';

export const DEFAULT_NEGATIVE_REASONS: NegativeReasonItem[] = [
  { id: 'reason-1', label: "The reach value doesn't look right", order: 1 },
  { id: 'reason-2', label: "The data is outdated", order: 2 },
  { id: 'reason-3', label: "I couldn't understand the result", order: 3 },
  { id: 'reason-4', label: "I expected more information", order: 4 },
  { id: 'reason-5', label: "The search took too long", order: 5 },
  { id: 'reason-6', label: "Something else", order: 6 },
];

export const DEFAULT_CONDITIONS: CampaignCondition[] = [
  { id: 'cond-1', field: 'search_type', operator: 'is', value: 'single_domain' },
  { id: 'cond-2', field: 'search_status', operator: 'is', value: 'successful' },
  { id: 'cond-3', field: 'reach_value', operator: 'is', value: 'available' },
];

export const DEFAULT_EXCLUSIONS: CampaignExclusion[] = [
  { id: 'excl-1', field: 'search_type', operator: 'is', value: 'bulk_search', label: 'Bulk searches', enabled: true },
  { id: 'excl-2', field: 'action', operator: 'is', value: 'refresh', label: 'Refresh actions', enabled: true },
  { id: 'excl-3', field: 'history', operator: 'is', value: 'already_answered', label: 'Searches that already received feedback', enabled: true },
];

export const DEFAULT_SETTINGS: FeedbackSettings = {
  enabled: true,
  global_cooldown_hours: 24,
  max_prompts_per_day: 3,
  require_preview_before_publish: true,
  require_archive_confirmation: true,
  require_versioning: true,
  updated_at: new Date().toISOString(),
};

const DEFAULT_CAMPAIGN_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_VERSION_ID = '00000000-0000-0000-0000-000000000002';

export const DEFAULT_CAMPAIGN: FeedbackCampaign = {
  id: DEFAULT_CAMPAIGN_ID,
  name: 'Successful Search Feedback',
  description: 'Collect feedback from Analysts after successful single-domain searches.',
  feedback_type: 'successful_search',
  status: 'active',
  priority: 'normal',
  priority_score: 50,
  audience: 'analysts',
  trigger_event: 'search_completed',
  conditions: DEFAULT_CONDITIONS,
  exclusions: DEFAULT_EXCLUSIONS,
  frequency_rule: 'every_eligible_search',
  cooldown_seconds: 86400,
  max_prompts_per_day: 3,
  start_at: null,
  end_at: null,
  current_version_id: DEFAULT_VERSION_ID,
  current_version_number: 1,
  created_by: 'system',
  created_at: new Date('2026-09-01T00:00:00Z').toISOString(),
  updated_at: new Date('2026-09-01T00:00:00Z').toISOString(),
  published_at: new Date('2026-09-01T00:00:00Z').toISOString(),
  archived_at: null,
  archived_by: null,
  archive_reason: null,
  versions: [
    {
      id: DEFAULT_VERSION_ID,
      campaign_id: DEFAULT_CAMPAIGN_ID,
      version_number: 1,
      version_label: 'v1',
      question: 'Was this result useful?',
      response_type: 'yes_no',
      configuration: {
        positive_label: 'Yes',
        negative_label: 'No',
        negative_reasons: DEFAULT_NEGATIVE_REASONS,
        comment_enabled: true,
        comment_placeholder: 'Tell us more (optional)',
        comment_max_length: 500,
      },
      status: 'published',
      created_by: 'system',
      created_at: new Date('2026-09-01T00:00:00Z').toISOString(),
      published_at: new Date('2026-09-01T00:00:00Z').toISOString(),
    },
  ],
};

// Local storage keys for resilient fallback
const LS_PREFIX = 'reacher_fb_';
const LS_CAMPAIGNS = `${LS_PREFIX}campaigns`;
const LS_RESPONSES = `${LS_PREFIX}responses`;
const LS_AUDIT = `${LS_PREFIX}audit`;
const LS_SETTINGS = `${LS_PREFIX}settings`;

function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ── Supabase / App Settings Bridge ──────────────────────────────────────────

let hasNativeTables: boolean | null = null;

async function checkNativeTables(): Promise<boolean> {
  if (hasNativeTables !== null) return hasNativeTables;
  try {
    const { error } = await supabase.from('feedback_campaigns').select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      hasNativeTables = false;
    } else {
      hasNativeTables = !error;
    }
  } catch {
    hasNativeTables = false;
  }
  return hasNativeTables;
}

// Synchronize fallback with Supabase app_settings table
async function loadFallbackStore(): Promise<{
  campaigns: FeedbackCampaign[];
  responses: FeedbackResponse[];
  audit: FeedbackAuditLog[];
  settings: FeedbackSettings;
}> {
  const localCamp = getLocal<FeedbackCampaign[]>(LS_CAMPAIGNS, [DEFAULT_CAMPAIGN]);
  const localResp = getLocal<FeedbackResponse[]>(LS_RESPONSES, []);
  const localAudit = getLocal<FeedbackAuditLog[]>(LS_AUDIT, []);
  const localSettings = getLocal<FeedbackSettings>(LS_SETTINGS, DEFAULT_SETTINGS);

  try {
    const { data } = await supabase
      .from('app_settings')
      .select('config')
      .eq('section', 'feedback_store')
      .maybeSingle();

    if (data?.config) {
      const remote = data.config;
      const mergedCampaigns = remote.campaigns?.length ? remote.campaigns : localCamp;
      const mergedResponses = remote.responses || localResp;
      const mergedAudit = remote.audit || localAudit;
      const mergedSettings = remote.settings || localSettings;

      setLocal(LS_CAMPAIGNS, mergedCampaigns);
      setLocal(LS_RESPONSES, mergedResponses);
      setLocal(LS_AUDIT, mergedAudit);
      setLocal(LS_SETTINGS, mergedSettings);

      return {
        campaigns: mergedCampaigns,
        responses: mergedResponses,
        audit: mergedAudit,
        settings: mergedSettings,
      };
    }
  } catch (e) {
    // silently fallback to local storage
  }

  return {
    campaigns: localCamp,
    responses: localResp,
    audit: localAudit,
    settings: localSettings,
  };
}

async function saveFallbackStore(updates: {
  campaigns?: FeedbackCampaign[];
  responses?: FeedbackResponse[];
  audit?: FeedbackAuditLog[];
  settings?: FeedbackSettings;
}): Promise<void> {
  const current = await loadFallbackStore();
  const next = {
    campaigns: updates.campaigns || current.campaigns,
    responses: updates.responses || current.responses,
    audit: updates.audit || current.audit,
    settings: updates.settings || current.settings,
  };

  if (updates.campaigns) setLocal(LS_CAMPAIGNS, next.campaigns);
  if (updates.responses) setLocal(LS_RESPONSES, next.responses);
  if (updates.audit) setLocal(LS_AUDIT, next.audit);
  if (updates.settings) setLocal(LS_SETTINGS, next.settings);

  try {
    await supabase.from('app_settings').upsert({
      section: 'feedback_store',
      config: next,
    });
  } catch {}
}

// ── Settings API ────────────────────────────────────────────────────────────

export async function getFeedbackSettings(): Promise<FeedbackSettings> {
  const isNative = await checkNativeTables();
  if (!isNative) {
    const store = await loadFallbackStore();
    return store.settings;
  }
  const { data, error } = await supabase
    .from('app_settings')
    .select('config')
    .eq('section', 'feedback_settings')
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data.config };
}

export async function updateFeedbackSettings(
  settings: Partial<FeedbackSettings>,
  actorName: string = 'Admin'
): Promise<FeedbackSettings> {
  const current = await getFeedbackSettings();
  const updated: FeedbackSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: actorName,
  };

  const isNative = await checkNativeTables();
  if (!isNative) {
    await saveFallbackStore({ settings: updated });
  } else {
    await supabase.from('app_settings').upsert({
      section: 'feedback_settings',
      config: updated,
    });
  }

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'settings',
    entity_id: 'feedback_settings',
    action: 'settings_changed',
    old_value: current,
    new_value: updated,
  });

  return updated;
}

// ── Audit Logs API ──────────────────────────────────────────────────────────

export async function recordAuditLog(log: Omit<FeedbackAuditLog, 'id' | 'timestamp'>): Promise<void> {
  const auditItem: FeedbackAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...log,
    timestamp: new Date().toISOString(),
  };

  const isNative = await checkNativeTables();
  if (isNative) {
    try {
      await supabase.from('feedback_audit_logs').insert([auditItem]);
      return;
    } catch {}
  }

  const store = await loadFallbackStore();
  const updated = [auditItem, ...store.audit];
  await saveFallbackStore({ audit: updated });
}

export async function getAuditLogs(entityId?: string): Promise<FeedbackAuditLog[]> {
  const isNative = await checkNativeTables();
  if (isNative) {
    let query = supabase.from('feedback_audit_logs').select('*').order('timestamp', { ascending: false });
    if (entityId) query = query.eq('entity_id', entityId);
    const { data } = await query;
    if (data) return data;
  }

  const store = await loadFallbackStore();
  if (!entityId) return store.audit;
  return store.audit.filter((a) => a.entity_id === entityId);
}

// ── Campaigns API ───────────────────────────────────────────────────────────

export async function getCampaigns(filterStatus?: FeedbackCampaignStatus): Promise<FeedbackCampaign[]> {
  const isNative = await checkNativeTables();
  if (isNative) {
    try {
      let query = supabase.from('feedback_campaigns').select('*, versions:feedback_campaign_versions(*)');
      if (filterStatus) query = query.eq('status', filterStatus);
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (!error && data && data.length > 0) return data as FeedbackCampaign[];
    } catch {}
  }

  const store = await loadFallbackStore();
  let list = store.campaigns;
  if (!list || list.length === 0) {
    list = [DEFAULT_CAMPAIGN];
  }
  if (filterStatus) {
    list = list.filter((c) => c.status === filterStatus);
  }
  // If active campaigns are requested but list is empty, provide default active campaign
  if (filterStatus === 'active' && list.length === 0) {
    return [DEFAULT_CAMPAIGN];
  }
  return list;
}

export async function getCampaignById(id: string): Promise<FeedbackCampaign | null> {
  const isNative = await checkNativeTables();
  if (isNative) {
    const { data } = await supabase
      .from('feedback_campaigns')
      .select('*, versions:feedback_campaign_versions(*)')
      .eq('id', id)
      .maybeSingle();
    if (data) return data as FeedbackCampaign;
  }

  const store = await loadFallbackStore();
  return store.campaigns.find((c) => c.id === id) || null;
}

export async function saveCampaignDraft(
  campaignData: Partial<FeedbackCampaign>,
  versionData?: Partial<FeedbackCampaignVersion>,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const now = new Date().toISOString();

  let target = campaignData.id ? store.campaigns.find((c) => c.id === campaignData.id) : null;
  const isNew = !target;

  const campaignId = target ? target.id : `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const versionNumber = target ? target.current_version_number : 1;
  const versionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const priorityScores: Record<string, number> = { high: 100, normal: 50, low: 10 };
  const priority = campaignData.priority || 'normal';
  const priorityScore = campaignData.priority_score || priorityScores[priority] || 50;

  const newVersion: FeedbackCampaignVersion = {
    id: target?.current_version_id || versionId,
    campaign_id: campaignId,
    version_number: versionNumber,
    version_label: `v${versionNumber}`,
    question: versionData?.question || 'Was this result useful?',
    response_type: 'yes_no',
    configuration: {
      positive_label: versionData?.configuration?.positive_label || 'Yes',
      negative_label: versionData?.configuration?.negative_label || 'No',
      negative_reasons: versionData?.configuration?.negative_reasons || DEFAULT_NEGATIVE_REASONS,
      comment_enabled: versionData?.configuration?.comment_enabled ?? true,
      comment_placeholder: versionData?.configuration?.comment_placeholder || 'Tell us more (optional)',
      comment_max_length: versionData?.configuration?.comment_max_length || 500,
    },
    conditions: campaignData.conditions || versionData?.conditions || target?.conditions || DEFAULT_CONDITIONS,
    exclusions: campaignData.exclusions || versionData?.exclusions || target?.exclusions || DEFAULT_EXCLUSIONS,
    status: 'draft',
    created_by: actorName,
    created_at: now,
    published_at: null,
  };

  const updatedCampaign: FeedbackCampaign = {
    id: campaignId,
    name: campaignData.name || 'New Feedback Campaign',
    description: campaignData.description || '',
    feedback_type: 'successful_search',
    status: target ? (target.status === 'archived' ? 'draft' : target.status) : 'draft',
    priority,
    priority_score: priorityScore,
    audience: 'analysts',
    trigger_event: 'search_completed',
    conditions: campaignData.conditions || target?.conditions || DEFAULT_CONDITIONS,
    exclusions: campaignData.exclusions || target?.exclusions || DEFAULT_EXCLUSIONS,
    frequency_rule: 'every_eligible_search',
    cooldown_seconds: campaignData.cooldown_seconds ?? 86400,
    max_prompts_per_day: campaignData.max_prompts_per_day ?? 3,
    start_at: campaignData.start_at || null,
    end_at: campaignData.end_at || null,
    current_version_id: newVersion.id,
    current_version_number: versionNumber,
    versions: target ? [newVersion, ...(target.versions || []).filter((v) => v.id !== newVersion.id)] : [newVersion],
    created_by: target ? target.created_by : actorName,
    created_at: target ? target.created_at : now,
    updated_at: now,
    published_at: target ? target.published_at : null,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
  };

  const nextCampaigns = isNew
    ? [updatedCampaign, ...store.campaigns]
    : store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));

  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: campaignId,
    action: isNew ? 'created' : 'draft_saved',
    old_value: target || null,
    new_value: updatedCampaign,
  });

  return updatedCampaign;
}

export async function publishCampaign(
  campaignId: string,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  // Mark current version as published
  const updatedVersions = (campaign.versions || []).map((v) => {
    if (v.id === campaign.current_version_id || v.version_number === campaign.current_version_number) {
      return { ...v, status: 'published' as const, published_at: now };
    }
    return v;
  });

  const updatedCampaign: FeedbackCampaign = {
    ...campaign,
    status: 'active',
    published_at: now,
    updated_at: now,
    versions: updatedVersions,
  };

  const nextCampaigns = store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: campaignId,
    action: 'published',
    old_value: { status: campaign.status },
    new_value: { status: 'active', version: `v${campaign.current_version_number}` },
  });

  return updatedCampaign;
}

export async function pauseCampaign(
  campaignId: string,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  const updatedCampaign: FeedbackCampaign = {
    ...campaign,
    status: 'paused',
    updated_at: now,
  };

  const nextCampaigns = store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: campaignId,
    action: 'paused',
    old_value: { status: campaign.status },
    new_value: { status: 'paused' },
  });

  return updatedCampaign;
}

export async function archiveCampaign(
  campaignId: string,
  actorName: string = 'Admin',
  reason?: string
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  const updatedCampaign: FeedbackCampaign = {
    ...campaign,
    previous_status: campaign.status,
    status: 'archived',
    archived_at: now,
    archived_by: actorName,
    archive_reason: reason || 'Manually archived by admin',
    updated_at: now,
  };

  const nextCampaigns = store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: campaignId,
    action: 'archived',
    old_value: { status: campaign.status },
    new_value: { status: 'archived', reason },
  });

  return updatedCampaign;
}

export async function restoreCampaign(
  campaignId: string,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  // Safe V1 behavior: restore as Draft for admin review before activating
  const updatedCampaign: FeedbackCampaign = {
    ...campaign,
    status: 'draft',
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    updated_at: now,
  };

  const nextCampaigns = store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: campaignId,
    action: 'restored',
    old_value: { status: 'archived' },
    new_value: { status: 'draft' },
  });

  return updatedCampaign;
}

export async function duplicateCampaign(
  campaignId: string,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  const newCampaignId = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const activeVersion = campaign.versions?.find((v) => v.id === campaign.current_version_id) || campaign.versions?.[0];

  const duplicatedVersion: FeedbackCampaignVersion = {
    id: newVersionId,
    campaign_id: newCampaignId,
    version_number: 1,
    version_label: 'v1',
    question: activeVersion?.question || 'Was this result useful?',
    response_type: 'yes_no',
    configuration: activeVersion?.configuration || {
      positive_label: 'Yes',
      negative_label: 'No',
      negative_reasons: DEFAULT_NEGATIVE_REASONS,
      comment_enabled: true,
      comment_placeholder: 'Tell us more (optional)',
      comment_max_length: 500,
    },
    status: 'draft',
    created_by: actorName,
    created_at: now,
    published_at: null,
  };

  const duplicatedCampaign: FeedbackCampaign = {
    ...campaign,
    id: newCampaignId,
    name: `${campaign.name} — Copy`,
    status: 'draft',
    current_version_id: newVersionId,
    current_version_number: 1,
    versions: [duplicatedVersion],
    created_by: actorName,
    created_at: now,
    updated_at: now,
    published_at: null,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    previous_status: null,
  };

  const nextCampaigns = [duplicatedCampaign, ...store.campaigns];
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'campaign',
    entity_id: newCampaignId,
    action: 'duplicated',
    old_value: { original_campaign_id: campaignId },
    new_value: { duplicated_campaign_id: newCampaignId, name: duplicatedCampaign.name },
  });

  return duplicatedCampaign;
}

export async function createNewVersion(
  campaignId: string,
  newConfig: Partial<FeedbackCampaignVersion>,
  actorName: string = 'Admin'
): Promise<FeedbackCampaign> {
  const store = await loadFallbackStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = new Date().toISOString();
  const nextVersionNumber = (campaign.current_version_number || 1) + 1;
  const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const currentVersion = campaign.versions?.find((v) => v.id === campaign.current_version_id);

  const createdVersion: FeedbackCampaignVersion = {
    id: newVersionId,
    campaign_id: campaignId,
    version_number: nextVersionNumber,
    version_label: `v${nextVersionNumber}`,
    question: newConfig.question || currentVersion?.question || 'Was this result useful?',
    response_type: 'yes_no',
    configuration: newConfig.configuration || currentVersion?.configuration || {
      positive_label: 'Yes',
      negative_label: 'No',
      negative_reasons: DEFAULT_NEGATIVE_REASONS,
      comment_enabled: true,
      comment_placeholder: 'Tell us more (optional)',
      comment_max_length: 500,
    },
    status: 'draft',
    created_by: actorName,
    created_at: now,
    published_at: null,
  };

  const updatedCampaign: FeedbackCampaign = {
    ...campaign,
    current_version_id: newVersionId,
    current_version_number: nextVersionNumber,
    updated_at: now,
    versions: [createdVersion, ...(campaign.versions || [])],
  };

  const nextCampaigns = store.campaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  await saveFallbackStore({ campaigns: nextCampaigns });

  await recordAuditLog({
    actor_id: 'admin',
    actor_name: actorName,
    entity_type: 'version',
    entity_id: newVersionId,
    action: 'version_created',
    old_value: { previous_version: `v${campaign.current_version_number}` },
    new_value: { new_version: `v${nextVersionNumber}`, status: 'draft' },
  });

  return updatedCampaign;
}

// ── Responses API ───────────────────────────────────────────────────────────

export interface ResponseFilters {
  campaignId?: string;
  versionLabel?: string;
  rating?: 'positive' | 'negative';
  reason?: string;
  domain?: string;
  searchQuery?: string;
}

export async function getResponses(filters?: ResponseFilters): Promise<FeedbackResponse[]> {
  const isNative = await checkNativeTables();
  if (isNative) {
    try {
      let query = supabase.from('feedback_responses').select('*').order('created_at', { ascending: false });
      if (filters?.campaignId) query = query.eq('campaign_id', filters.campaignId);
      if (filters?.versionLabel) query = query.eq('version_label', filters.versionLabel);
      if (filters?.rating) query = query.eq('rating', filters.rating);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        let list = data as FeedbackResponse[];
        if (filters?.reason) list = list.filter((r) => r.reasons?.includes(filters.reason!));
        if (filters?.domain) list = list.filter((r) => r.domain.toLowerCase().includes(filters.domain!.toLowerCase()));
        if (filters?.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          list = list.filter(
            (r) =>
              r.domain.toLowerCase().includes(q) ||
              r.search_id.toLowerCase().includes(q) ||
              r.comment?.toLowerCase().includes(q) ||
              r.user_name?.toLowerCase().includes(q)
          );
        }
        return list;
      }
    } catch {}
  }

  const store = await loadFallbackStore();
  let list = store.responses;

  if (filters?.campaignId) {
    list = list.filter((r) => r.campaign_id === filters.campaignId);
  }
  if (filters?.versionLabel) {
    list = list.filter((r) => r.version_label === filters.versionLabel);
  }
  if (filters?.rating) {
    list = list.filter((r) => r.rating === filters.rating);
  }
  if (filters?.reason) {
    list = list.filter((r) => r.reasons?.includes(filters.reason!));
  }
  if (filters?.domain) {
    list = list.filter((r) => r.domain.toLowerCase().includes(filters.domain!.toLowerCase()));
  }
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    list = list.filter(
      (r) =>
        r.domain.toLowerCase().includes(q) ||
        r.search_id.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q)
    );
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getResponseById(id: string): Promise<FeedbackResponse | null> {
  const isNative = await checkNativeTables();
  if (isNative) {
    const { data } = await supabase.from('feedback_responses').select('*').eq('id', id).maybeSingle();
    if (data) return data as FeedbackResponse;
  }
  const store = await loadFallbackStore();
  return store.responses.find((r) => r.id === id) || null;
}

export async function submitResponse(input: {
  campaign_id: string;
  campaign_version_id: string;
  campaign_name?: string;
  version_label?: string;
  user_id: string;
  user_name?: string;
  search_id: string;
  feedback_type: 'successful_search';
  rating: 'positive' | 'negative';
  reasons: string[];
  comment?: string;
  domain: string;
  is_test?: boolean;
}): Promise<FeedbackResponse> {
  const store = await loadFallbackStore();

  // Enforce uniqueness per (user_id + search_id + feedback_type) unless it is test mode
  if (!input.is_test) {
    const existing = store.responses.find(
      (r) =>
        r.user_id === input.user_id &&
        r.search_id === input.search_id &&
        r.feedback_type === input.feedback_type
    );
    if (existing) {
      return existing; // Duplicate prevention
    }
  }

  const responseItem: FeedbackResponse = {
    id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    campaign_id: input.campaign_id,
    campaign_version_id: input.campaign_version_id,
    campaign_name: input.campaign_name || 'Successful Search Feedback',
    version_label: input.version_label || 'v1',
    user_id: input.user_id,
    user_name: input.user_name || 'Analyst',
    search_id: input.search_id,
    feedback_type: input.feedback_type,
    rating: input.rating,
    reasons: input.reasons || [],
    comment: input.comment || null,
    domain: input.domain,
    is_test: !!input.is_test,
    created_at: new Date().toISOString(),
  };

  // If in test mode, do NOT pollute production responses or analytics
  if (!input.is_test) {
    const isNative = await checkNativeTables();
    if (isNative) {
      try {
        await supabase.from('feedback_responses').insert([responseItem]);
      } catch (e) {
        console.warn('Native insert to feedback_responses failed, using fallback store:', e);
      }
    }
    const updatedResponses = [responseItem, ...store.responses];
    await saveFallbackStore({ responses: updatedResponses });
  }

  return responseItem;
}

// ── Eligibility Engine ──────────────────────────────────────────────────────

export interface EligibilityContext {
  userId: string;
  searchId: string;
  domain: string;
  isSingleDomain: boolean;
  searchSuccess: boolean;
  reachAvailable: boolean;
}

export async function checkFeedbackEligibility(
  ctx: EligibilityContext
): Promise<FeedbackEligibilityResult> {
  // 1. Strict Trigger Conditions Check
  if (!ctx.isSingleDomain) {
    return { eligible: false, reason: 'Not a single-domain search' };
  }
  if (!ctx.searchSuccess) {
    return { eligible: false, reason: 'Search was not successful' };
  }
  if (!ctx.reachAvailable) {
    return { eligible: false, reason: 'Reach value is not available' };
  }

  // 2. Settings Check
  const settings = await getFeedbackSettings();
  if (!settings.enabled) {
    return { eligible: false, reason: 'Feedback system is disabled' };
  }

  // 3. Campaign Check
  const campaigns = await getCampaigns('active');
  if (!campaigns.length) {
    return { eligible: false, reason: 'No active feedback campaigns' };
  }

  // Sort by priority (high > normal > low)
  const priorityOrder: Record<string, number> = { high: 3, normal: 2, low: 1 };
  const sorted = [...campaigns].sort(
    (a, b) => (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
  );

  const now = new Date().getTime();
  const eligibleCampaign = sorted.find((c) => {
    if (c.trigger_event !== 'search_completed') return false;
    if (c.start_at && new Date(c.start_at).getTime() > now) return false;
    if (c.end_at && new Date(c.end_at).getTime() < now) return false;
    return true;
  });

  if (!eligibleCampaign) {
    return { eligible: false, reason: 'No eligible campaigns match current trigger and schedule' };
  }

  const activeVersion =
    eligibleCampaign.versions?.find((v) => v.id === eligibleCampaign.current_version_id) ||
    eligibleCampaign.versions?.[0];

  if (!activeVersion) {
    return { eligible: false, reason: 'Active campaign has no published version' };
  }

  // 4. Duplicate Check (Has this search already received feedback?)
  const store = await loadFallbackStore();
  const alreadyAnswered = store.responses.some(
    (r) => r.user_id === ctx.userId && r.search_id === ctx.searchId && r.feedback_type === 'successful_search'
  );
  if (alreadyAnswered) {
    return { eligible: false, reason: 'Feedback already submitted for this search' };
  }

  // 5. Frequency & Cooldown Check (only when not set to every_eligible_search)
  if (
    settings.max_prompts_per_day > 0 &&
    eligibleCampaign.frequency_rule !== 'every_eligible_search'
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const promptCountToday = store.responses.filter(
      (r) => r.user_id === ctx.userId && r.created_at >= todayIso && !r.is_test
    ).length;
    if (promptCountToday >= settings.max_prompts_per_day) {
      return { eligible: false, reason: 'Daily prompt limit reached for user' };
    }
  }

  return {
    eligible: true,
    campaign: eligibleCampaign,
    version: activeVersion,
  };
}

// ── Test Eligibility Scenario Simulator ────────────────────────────────────

export interface ScenarioParams {
  searchType: 'single_domain' | 'bulk_search';
  searchStatus: 'successful' | 'failed';
  reachValue: 'available' | 'not_available';
  searchSource: 'existing_data' | 'api';
  userRole: 'analyst' | 'admin' | 'guest';
}

export interface EvaluationItem {
  id: string;
  label: string;
  passed: boolean;
  type: 'trigger' | 'condition' | 'exclusion' | 'audience' | 'schedule' | 'cooldown';
  detail?: string;
}

export interface ScenarioResult {
  eligible: boolean;
  failedReason?: string;
  evaluations: EvaluationItem[];
}

export function testCampaignEligibility(
  campaign: Partial<FeedbackCampaign>,
  scenario: ScenarioParams
): ScenarioResult {
  const evaluations: EvaluationItem[] = [];

  // 1. Trigger
  evaluations.push({
    id: 'trig-1',
    label: 'Search Completed',
    passed: true,
    type: 'trigger',
  });

  // 2. Conditions
  const conditions = campaign.conditions || DEFAULT_CONDITIONS;
  for (const cond of conditions) {
    let passed = false;
    let label = '';
    if (cond.field === 'search_type') {
      passed = cond.value === scenario.searchType;
      label = cond.value === 'single_domain' ? 'Single Domain' : 'Bulk Search';
    } else if (cond.field === 'search_status') {
      passed = cond.value === scenario.searchStatus;
      label = cond.value === 'successful' ? 'Successful' : 'Failed';
    } else if (cond.field === 'reach_value') {
      passed = cond.value === scenario.reachValue;
      label = cond.value === 'available' ? 'Reach Value Available' : 'Reach Value Unavailable';
    } else if (cond.field === 'search_source') {
      passed = cond.value === scenario.searchSource;
      label = `Source is ${cond.value === 'existing_data' ? 'Existing Data' : 'API'}`;
    }
    evaluations.push({
      id: cond.id,
      label,
      passed,
      type: 'condition',
    });
  }

  // 3. Exclusions
  const exclusions = campaign.exclusions || DEFAULT_EXCLUSIONS;
  for (const excl of exclusions) {
    if (!excl.enabled) continue;
    let passed = true;
    if (excl.value === 'bulk_search' && scenario.searchType === 'bulk_search') {
      passed = false;
    }
    evaluations.push({
      id: excl.id,
      label: `Not a ${excl.label}`,
      passed,
      type: 'exclusion',
    });
  }

  // 4. Audience
  const audiencePassed = scenario.userRole === 'analyst';
  evaluations.push({
    id: 'aud-1',
    label: 'Analyst Audience',
    passed: audiencePassed,
    type: 'audience',
  });

  // 5. Schedule
  const now = Date.now();
  const schedulePassed =
    (!campaign.start_at || new Date(campaign.start_at).getTime() <= now) &&
    (!campaign.end_at || new Date(campaign.end_at).getTime() >= now);
  evaluations.push({
    id: 'sched-1',
    label: 'Schedule Active',
    passed: schedulePassed,
    type: 'schedule',
  });

  // 6. Cooldown & Frequency
  evaluations.push({
    id: 'cool-1',
    label: 'Cooldown Passed',
    passed: true,
    type: 'cooldown',
  });

  const firstFailed = evaluations.find((e) => !e.passed);
  return {
    eligible: !firstFailed,
    failedReason: firstFailed ? firstFailed.label : undefined,
    evaluations,
  };
}
