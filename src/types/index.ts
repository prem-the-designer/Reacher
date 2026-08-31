// ── Shared ──────────────────────────────────────────────────────────────────

export type Role = 'analyst' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type AuthState =
  | 'default'
  | 'signing_in'
  | 'cancelled'
  | 'unregistered'
  | 'failed'
  | 'success_analyst'
  | 'success_admin'
  | 'pending_approval'
  | 'forbidden_non_analyst';

// ── Domain / Search ──────────────────────────────────────────────────────────

export type DataSource = 'Master Database' | 'API Fetch';

export interface DomainRecord {
  id: string;
  domain_name: string;
  reach_value: number;
  provider: string | null;
  country: string | null;
  media_type: string | null;
  publication: string | null;
  granularity: string | null;
  data_source: DataSource;
  last_updated: string; // ISO
}

export type SearchStateMode =
  | 'idle'
  | 'searching'
  | 'found'
  | 'not_found'
  | 'fetching'
  | 'success'
  | 'error';

export type ErrorType =
  | 'domain_unavailable'
  | 'rate_limited'
  | 'server_failure'
  | 'network_failure'
  | 'database_unavailable';

export type ErrorPhase = 'search' | 'fetch';

export interface SearchState {
  mode: SearchStateMode;
  inputDomain: string;
  normalizedDomain: string;
  record: DomainRecord | null;
  errorType: ErrorType | null;
  errorMessage: string | null;
  errorPhase: ErrorPhase | null;
}

// ── Admin Navigation ─────────────────────────────────────────────────────────

export type AdminModule =
  | 'dashboard'
  | 'search'
  | 'user-activity'
  | 'import-export'
  | 'users'
  | 'logs'
  | 'settings';

// ── Admin Users ──────────────────────────────────────────────────────────────

// Extend UserStatus to include pending
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  last_login: string | null; // ISO or null if never
  created_at: string;
}

// ── Reach Requests ───────────────────────────────────────────────────────────

export type ReachRequestStatus = 'pending' | 'processing' | 'fulfilled' | 'failed';

export interface ReachRequest {
  id: string;
  domain_name: string;
  requested_by: string; // user email or id
  status: ReachRequestStatus;
  created_at: string;
  fulfilled_at: string | null;
}

// ── Activity Logs ────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  user_id: string;
  user_display: string; // resolved display name/email
  action_type: string;
  resource_type: string;
  resource_id: string;
  details: string;
  timestamp: string;
}

export interface RequestLog {
  id: string;
  domain_name: string;
  requested_by: string;
  status: ReachRequestStatus;
  created_at: string;
  fulfilled_at: string | null;
}

export interface ApiLog {
  id: string;
  operation: string;       // e.g. "reach_value_fetch"
  resource: string;        // e.g. domain name
  status: 'success' | 'failed' | 'rate_limited';
  duration_ms: number;
  timestamp: string;
  // NOTE: keys, tokens and secrets are NEVER included — backend strips them
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  error_context: string;
  related_resource: string | null;
  status: 'open' | 'resolved';
  diagnostic: string; // safe diagnostic detail only — no stack traces, no secrets
}

export type LogType = 'activity' | 'request' | 'api' | 'error';

// ── Import / Export ──────────────────────────────────────────────────────────

export type ImportJobStatus =
  | 'idle'
  | 'uploading'
  | 'validating'
  | 'validation_complete'
  | 'confirming'
  | 'importing'
  | 'complete'
  | 'failed';

export interface ImportValidationError {
  row: number;
  field: string;
  reason: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  file_size_bytes: number;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  status: ImportJobStatus;
  rows_inserted: number;
  rows_rejected: number;
  validation_errors: ImportValidationError[];
  started_at: string;
  completed_at: string | null;
}

export type ExportFormat = 'csv' | 'excel';
export type ExportStatus = 'ready' | 'processing' | 'success' | 'failed';

// ── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardCardStatus = 'loading' | 'loaded' | 'unavailable' | 'permission_error';

export interface DashboardCardData {
  id: string;
  label: string;
  value: string | number | null;
  context: string | null;
  linkModule: AdminModule | null;
  status: DashboardCardStatus;
  badgeVariant?: 'secondary' | 'outline' | 'destructive' | 'warning';
  badgeLabel?: string;
}

export interface DashboardActivity {
  id: string;
  description: string;
  timestamp: string;
  category: 'request' | 'import' | 'user' | 'system';
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'new_request'
  | 'bulk_import_completed'
  | 'high_request_volume'
  | 'low_api_credits'
  | 'system_alert';

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  link_module: AdminModule | null;
  link_label: string | null;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface ApiConfigSettings {
  // NOTE: actual key is never returned to the browser — only metadata
  credential_set: boolean;
  credential_last_updated: string | null;
}

export interface CreditLimiterSettings {
  // TODO(backend): threshold values come from backend configuration — never hardcoded
  warning_threshold: number | null;
  critical_threshold: number | null;
  current_credits: number | null;
  credits_last_refreshed: string | null;
}

export interface DataRefreshSettings {
  // TODO(backend): only rules the backend actually supports — none invented
  schedule_description: string | null;
  last_refresh: string | null;
  next_refresh: string | null;
}

export interface SimilarwebFunctionSettings {
  enabled: boolean;
  country: boolean;
  granularity: boolean;
  web_source: boolean;
  metrics: boolean;
}

export interface SimilarwebSettings {
  SIMILARWEB_WEBSITES_TRAFFIC_AND_ENGAGEMENT: SimilarwebFunctionSettings;
  SIMILARWEB_WEBSITES_TRAFFIC_SOURCES: SimilarwebFunctionSettings;
  SIMILARWEB_WEBSITES_PPC_SPEND: SimilarwebFunctionSettings;
  SIMILARWEB_SEGMENTS_TRAFFIC_AND_ENGAGEMENT: SimilarwebFunctionSettings;
  SIMILARWEB_SEGMENTS_TRAFFIC_SOURCES: SimilarwebFunctionSettings;
  SIMILARWEB_WEBSITES_TOP_GEOGRAPHY: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORDS_POSITION_TREND: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORD_RESEARCH_BRANDED_DISTRIBUTION_BY_CLICKS: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORD_RESEARCH_KEYWORDS_OVERVIEW: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORD_RESEARCH_LANDING_PAGES: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORD_RESEARCH_SERP_PLAYERS: SimilarwebFunctionSettings;
  SIMILARWEB_KEYWORD_RESEARCH_WEBSITE_KEYWORDS: SimilarwebFunctionSettings;
  SIMILARWEB_LEAD_ENRICHMENT: SimilarwebFunctionSettings;
  SIMILARWEB_CONTACTS_SEARCH: SimilarwebFunctionSettings;
  SIMILARWEB_CONTACTS_ENRICHMENT: SimilarwebFunctionSettings;
  SIMILARWEB_AI_OUTREACH: SimilarwebFunctionSettings;
}

export interface SettingsConfig {
  api: ApiConfigSettings;
  credits: CreditLimiterSettings;
  data_refresh: DataRefreshSettings;
  similarweb?: SimilarwebSettings;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
