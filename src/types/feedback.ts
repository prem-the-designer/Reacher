export type FeedbackCampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

export type FeedbackType = 'successful_search';

export type FeedbackPriority = 'low' | 'normal' | 'high';

export type FeedbackAudience = 'analysts';

export type TriggerEvent = 'search_completed';

export type FeedbackRating = 'positive' | 'negative';

export interface NegativeReasonItem {
  id: string;
  label: string;
  order: number;
}

export type ConditionField = 'search_type' | 'search_status' | 'reach_value' | 'search_source';
export type ConditionOperator = 'is';

export interface CampaignCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface CampaignExclusion {
  id: string;
  field: ConditionField | 'action' | 'history';
  operator: ConditionOperator;
  value: string;
  label: string;
  enabled: boolean;
}

export interface FeedbackCampaignVersionConfig {
  positive_label?: string; // default "Yes"
  negative_label?: string; // default "No"
  negative_reasons: NegativeReasonItem[];
  comment_enabled: boolean;
  comment_placeholder?: string;
  comment_max_length?: number;
}

export interface FeedbackCampaignVersion {
  id: string;
  campaign_id: string;
  version_number: number; // e.g. 1 for v1, 2 for v2
  version_label: string;  // e.g. "v1"
  question: string;
  response_type: 'yes_no';
  configuration: FeedbackCampaignVersionConfig;
  conditions?: CampaignCondition[];
  exclusions?: CampaignExclusion[];
  status: 'draft' | 'published' | 'deprecated';
  created_by: string;
  created_at: string;
  published_at: string | null;
}

export interface FeedbackCampaign {
  id: string;
  name: string;
  description: string;
  feedback_type: FeedbackType;
  status: FeedbackCampaignStatus;
  priority: FeedbackPriority;
  priority_score?: number; // High = 100, Normal = 50, Low = 10
  audience: FeedbackAudience;
  trigger_event: TriggerEvent;
  conditions?: CampaignCondition[];
  exclusions?: CampaignExclusion[];
  frequency_rule: 'every_eligible_search';
  cooldown_seconds: number; // e.g. 0 for none, 86400 for 24h
  max_prompts_per_day?: number; // default 3
  start_at: string | null; // ISO string or null for immediate
  end_at: string | null;   // ISO string or null for no end date
  current_version_id: string | null;
  current_version_number: number;
  versions?: FeedbackCampaignVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  previous_status?: FeedbackCampaignStatus | null;
}

export interface FeedbackResponse {
  id: string;
  campaign_id: string;
  campaign_version_id: string;
  campaign_name?: string;
  version_label?: string;
  user_id: string;
  user_name?: string;
  search_id: string;
  feedback_type: FeedbackType;
  rating: FeedbackRating;
  reasons: string[];
  comment: string | null;
  domain: string;
  is_test?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FeedbackAuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  entity_type: 'campaign' | 'version' | 'response' | 'settings';
  entity_id: string;
  action: 
    | 'created' 
    | 'edited' 
    | 'draft_saved' 
    | 'version_created' 
    | 'published' 
    | 'paused' 
    | 'archived' 
    | 'restored' 
    | 'duplicated' 
    | 'settings_changed';
  old_value: any | null;
  new_value: any | null;
  timestamp: string;
}

export interface FeedbackSettings {
  enabled: boolean;
  global_cooldown_hours: number;
  max_prompts_per_day: number;
  require_preview_before_publish: boolean;
  require_archive_confirmation: boolean;
  require_versioning: boolean;
  updated_at: string;
  updated_by?: string;
}

export interface FeedbackEligibilityResult {
  eligible: boolean;
  campaign?: FeedbackCampaign;
  version?: FeedbackCampaignVersion;
  reason?: string;
}
