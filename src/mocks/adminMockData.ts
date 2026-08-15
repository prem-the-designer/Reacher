/**
 * Admin Portal mock data
 * All mocks live here and are used only through adminService.ts
 * The real backend drops in by replacing adminService.ts — no UI changes needed.
 */

import type {
  UserRecord,
  ReachRequest,
  ActivityLog,
  RequestLog,
  ApiLog,
  ErrorLog,
  ImportJob,
  DashboardActivity,
  Notification,
  SettingsConfig,
} from '@/types';

// ── Users ────────────────────────────────────────────────────────────────────

export const MOCK_USERS: UserRecord[] = [
  {
    id: 'usr-001',
    email: 'sarah.chen@company.com',
    name: 'Sarah Chen',
    role: 'analyst',
    status: 'active',
    last_login: '2026-08-15T07:42:00Z',
    created_at: '2026-01-10T09:00:00Z',
  },
  {
    id: 'usr-002',
    email: 'jordan.miller@company.com',
    name: 'Jordan Miller',
    role: 'admin',
    status: 'active',
    last_login: '2026-08-15T08:01:00Z',
    created_at: '2025-11-05T09:00:00Z',
  },
  {
    id: 'usr-003',
    email: 'alex.patel@company.com',
    name: 'Alex Patel',
    role: 'analyst',
    status: 'active',
    last_login: '2026-08-14T16:30:00Z',
    created_at: '2026-02-20T09:00:00Z',
  },
  {
    id: 'usr-004',
    email: 'priya.sharma@company.com',
    name: 'Priya Sharma',
    role: 'analyst',
    status: 'inactive',
    last_login: '2026-06-01T10:15:00Z',
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'usr-005',
    email: 'tom.nguyen@company.com',
    name: 'Tom Nguyen',
    role: 'analyst',
    status: 'active',
    last_login: '2026-08-15T06:55:00Z',
    created_at: '2026-03-01T09:00:00Z',
  },
  {
    id: 'usr-006',
    email: 'maya.osei@company.com',
    name: 'Maya Osei',
    role: 'analyst',
    status: 'active',
    last_login: '2026-08-13T14:20:00Z',
    created_at: '2026-04-12T09:00:00Z',
  },
];

// ── Reach Requests ───────────────────────────────────────────────────────────

export const MOCK_REACH_REQUESTS: ReachRequest[] = [
  {
    id: 'req-001',
    domain_name: 'techcrunch.com',
    requested_by: 'sarah.chen@company.com',
    status: 'fulfilled',
    created_at: '2026-08-15T06:30:00Z',
    fulfilled_at: '2026-08-15T06:31:05Z',
  },
  {
    id: 'req-002',
    domain_name: 'wired.com',
    requested_by: 'alex.patel@company.com',
    status: 'pending',
    created_at: '2026-08-15T07:45:00Z',
    fulfilled_at: null,
  },
  {
    id: 'req-003',
    domain_name: 'bloomberg.com',
    requested_by: 'tom.nguyen@company.com',
    status: 'processing',
    created_at: '2026-08-15T08:00:00Z',
    fulfilled_at: null,
  },
  {
    id: 'req-004',
    domain_name: 'theverge.com',
    requested_by: 'maya.osei@company.com',
    status: 'fulfilled',
    created_at: '2026-08-14T14:10:00Z',
    fulfilled_at: '2026-08-14T14:10:58Z',
  },
  {
    id: 'req-005',
    domain_name: 'rate-limit.test',
    requested_by: 'sarah.chen@company.com',
    status: 'failed',
    created_at: '2026-08-14T09:00:00Z',
    fulfilled_at: null,
  },
];

// ── Activity Logs ────────────────────────────────────────────────────────────

export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'act-001',
    user_id: 'usr-002',
    user_display: 'Jordan Miller (jordan.miller@company.com)',
    action_type: 'user.create',
    resource_type: 'User',
    resource_id: 'usr-006',
    details: 'Created user maya.osei@company.com with role Analyst',
    timestamp: '2026-08-15T08:05:00Z',
  },
  {
    id: 'act-002',
    user_id: 'usr-001',
    user_display: 'Sarah Chen (sarah.chen@company.com)',
    action_type: 'reach.fetch',
    resource_type: 'DomainRecord',
    resource_id: 'techcrunch.com',
    details: 'Fetched reach value for techcrunch.com via API',
    timestamp: '2026-08-15T06:31:05Z',
  },
  {
    id: 'act-003',
    user_id: 'usr-002',
    user_display: 'Jordan Miller (jordan.miller@company.com)',
    action_type: 'import.start',
    resource_type: 'ImportJob',
    resource_id: 'imp-001',
    details: 'Initiated bulk import: dbo_reach_aug2026.xlsx (1,240 rows)',
    timestamp: '2026-08-14T10:00:00Z',
  },
  {
    id: 'act-004',
    user_id: 'usr-002',
    user_display: 'Jordan Miller (jordan.miller@company.com)',
    action_type: 'user.status_change',
    resource_type: 'User',
    resource_id: 'usr-004',
    details: 'Set priya.sharma@company.com status to Inactive',
    timestamp: '2026-08-13T11:30:00Z',
  },
  {
    id: 'act-005',
    user_id: 'usr-003',
    user_display: 'Alex Patel (alex.patel@company.com)',
    action_type: 'reach.search',
    resource_type: 'DomainRecord',
    resource_id: 'bbc.com',
    details: 'Searched for bbc.com — returned from Master Database',
    timestamp: '2026-08-14T16:25:00Z',
  },
];

// ── Request Logs ─────────────────────────────────────────────────────────────

export const MOCK_REQUEST_LOGS: RequestLog[] = MOCK_REACH_REQUESTS.map((r) => ({
  id: r.id,
  domain_name: r.domain_name,
  requested_by: r.requested_by,
  status: r.status,
  created_at: r.created_at,
  fulfilled_at: r.fulfilled_at,
}));

// ── API Logs ─────────────────────────────────────────────────────────────────
// NOTE: No keys, secrets or tokens — ever. Backend strips them before sending.

export const MOCK_API_LOGS: ApiLog[] = [
  {
    id: 'api-001',
    operation: 'reach_value_fetch',
    resource: 'techcrunch.com',
    status: 'success',
    duration_ms: 1051,
    timestamp: '2026-08-15T06:31:04Z',
  },
  {
    id: 'api-002',
    operation: 'reach_value_fetch',
    resource: 'rate-limit.test',
    status: 'rate_limited',
    duration_ms: 302,
    timestamp: '2026-08-14T09:00:12Z',
  },
  {
    id: 'api-003',
    operation: 'reach_value_fetch',
    resource: 'bloomberg.com',
    status: 'success',
    duration_ms: 890,
    timestamp: '2026-08-14T08:10:03Z',
  },
  {
    id: 'api-004',
    operation: 'reach_value_fetch',
    resource: 'wired.com',
    status: 'failed',
    duration_ms: 5012,
    timestamp: '2026-08-13T15:40:22Z',
  },
];

// ── Error Logs ───────────────────────────────────────────────────────────────
// NOTE: diagnostic contains only safe contextual information — no stack traces, no secrets.

export const MOCK_ERROR_LOGS: ErrorLog[] = [
  {
    id: 'err-001',
    timestamp: '2026-08-14T09:00:14Z',
    error_context: 'API rate limit exceeded during reach value fetch',
    related_resource: 'rate-limit.test',
    status: 'resolved',
    diagnostic: 'HTTP 429 received from reach data provider. Retry after 60 seconds.',
  },
  {
    id: 'err-002',
    timestamp: '2026-08-14T08:30:00Z',
    error_context: 'Import validation failed — invalid domain format in 3 rows',
    related_resource: 'imp-002',
    status: 'open',
    diagnostic: 'Rows 14, 87, 203 contain malformed domain values. See validation report.',
  },
  {
    id: 'err-003',
    timestamp: '2026-08-13T15:40:25Z',
    error_context: 'Reach value fetch timeout for wired.com',
    related_resource: 'wired.com',
    status: 'open',
    diagnostic: 'Request exceeded 5 000ms timeout. Provider may be temporarily unavailable.',
  },
];

// ── Import Jobs ───────────────────────────────────────────────────────────────

export const MOCK_IMPORT_JOBS: ImportJob[] = [
  {
    id: 'imp-001',
    filename: 'dbo_reach_aug2026.xlsx',
    file_size_bytes: 284500,
    total_rows: 1240,
    valid_rows: 1240,
    invalid_rows: 0,
    status: 'complete',
    rows_inserted: 1240,
    rows_rejected: 0,
    validation_errors: [],
    started_at: '2026-08-14T10:00:00Z',
    completed_at: '2026-08-14T10:02:14Z',
  },
  {
    id: 'imp-002',
    filename: 'dbo_reach_partial.xlsx',
    file_size_bytes: 97200,
    total_rows: 412,
    valid_rows: 409,
    invalid_rows: 3,
    status: 'complete',
    rows_inserted: 409,
    rows_rejected: 3,
    validation_errors: [
      { row: 14, field: 'domain_name', reason: 'Invalid domain format: "not a domain"' },
      { row: 87, field: 'reach_value', reason: 'Value must be a positive integer, got "N/A"' },
      { row: 203, field: 'domain_name', reason: 'Invalid domain format: "http://"' },
    ],
    started_at: '2026-08-13T14:00:00Z',
    completed_at: '2026-08-13T14:01:30Z',
  },
];

// ── Dashboard Activity ────────────────────────────────────────────────────────

export const MOCK_DASHBOARD_ACTIVITY: DashboardActivity[] = [
  {
    id: 'da-001',
    description: 'Sarah Chen retrieved reach value for techcrunch.com',
    timestamp: '2026-08-15T06:31:05Z',
    category: 'request',
  },
  {
    id: 'da-002',
    description: 'Bulk import completed: dbo_reach_aug2026.xlsx (1,240 rows)',
    timestamp: '2026-08-14T10:02:14Z',
    category: 'import',
  },
  {
    id: 'da-003',
    description: 'New user maya.osei@company.com added (Analyst)',
    timestamp: '2026-08-15T08:05:00Z',
    category: 'user',
  },
  {
    id: 'da-004',
    description: 'Alex Patel requested reach value for wired.com',
    timestamp: '2026-08-15T07:45:00Z',
    category: 'request',
  },
];

// ── Notifications ─────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-001',
    category: 'new_request',
    title: 'New reach value request',
    body: 'Alex Patel requested a reach value for wired.com.',
    read: false,
    created_at: '2026-08-15T07:45:00Z',
    link_module: 'user-activity',
    link_label: 'View in Request Activity',
  },
  {
    id: 'notif-002',
    category: 'new_request',
    title: 'New reach value request',
    body: 'Tom Nguyen requested a reach value for bloomberg.com.',
    read: false,
    created_at: '2026-08-15T08:00:00Z',
    link_module: 'user-activity',
    link_label: 'View in Request Activity',
  },
  {
    id: 'notif-003',
    category: 'bulk_import_completed',
    title: 'Bulk import completed',
    body: 'dbo_reach_aug2026.xlsx imported successfully — 1,240 rows added.',
    read: true,
    created_at: '2026-08-14T10:02:14Z',
    link_module: 'import-export',
    link_label: 'View import summary',
  },
  {
    id: 'notif-004',
    category: 'low_api_credits',
    title: 'API credits low',
    // TODO(backend): threshold is backend-defined — this body text is a placeholder
    body: 'Remaining API credits are approaching the warning threshold.',
    read: false,
    created_at: '2026-08-14T09:30:00Z',
    link_module: 'settings',
    link_label: 'Review Credit Limiter',
  },
  {
    id: 'notif-005',
    category: 'system_alert',
    title: 'Rate limit hit during reach fetch',
    body: 'A reach value request for rate-limit.test was rate-limited by the data provider.',
    read: true,
    created_at: '2026-08-14T09:00:14Z',
    link_module: 'logs',
    link_label: 'View in Error Logs',
  },
];

// ── Settings ──────────────────────────────────────────────────────────────────

export const MOCK_SETTINGS: SettingsConfig = {
  api: {
    credential_set: true,
    credential_last_updated: '2026-07-01T12:00:00Z',
  },
  credits: {
    // TODO(backend): warning_threshold and critical_threshold come from backend configuration
    warning_threshold: null,
    critical_threshold: null,
    current_credits: 8420,
    credits_last_refreshed: '2026-08-15T00:00:00Z',
  },
  data_refresh: {
    // TODO(backend): only rules the backend actually supports
    schedule_description: null,
    last_refresh: '2026-08-15T00:00:00Z',
    next_refresh: null,
  },
};
