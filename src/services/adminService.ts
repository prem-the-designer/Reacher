/**
 * Admin API Service
 * The ONLY layer that knows about transport.
 * Swap the implementations here to connect the real backend — zero UI changes needed.
 */

import type {
  UserRecord,
  ReachRequest,
  ActivityLog,
  RequestLog,
  ApiLog,
  ErrorLog,
  LogType,
  ImportJob,
  DashboardCardData,
  DashboardActivity,
  Notification,
  SettingsConfig,
  PaginationState,
  ExportFormat,
  Role,
  UserStatus,
} from '@/types';

import {
  MOCK_USERS,
  MOCK_REACH_REQUESTS,
  MOCK_ACTIVITY_LOGS,
  MOCK_REQUEST_LOGS,
  MOCK_API_LOGS,
  MOCK_ERROR_LOGS,
  MOCK_IMPORT_JOBS,
  MOCK_DASHBOARD_ACTIVITY,
  MOCK_NOTIFICATIONS,
  MOCK_SETTINGS,
} from '@/mocks/adminMockData';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Runtime mutation stores
let runtimeUsers = [...MOCK_USERS];
let runtimeNotifications = [...MOCK_NOTIFICATIONS];
let runtimeSettings = { ...MOCK_SETTINGS };
let runtimeImportJobs = [...MOCK_IMPORT_JOBS];

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardCards(): Promise<DashboardCardData[]> {
  await delay(400);

  const pendingRequests = MOCK_REACH_REQUESTS.filter((r) => r.status === 'pending').length;
  const loggedInUsers = runtimeUsers.filter((u) => u.status === 'active' && u.last_login).length;
  const lastImport = runtimeImportJobs[0] ?? null;

  return [
    {
      id: 'card-requests',
      label: 'New Reach Value Requests',
      value: pendingRequests,
      context: `${MOCK_REACH_REQUESTS.filter((r) => r.status === 'processing').length} processing`,
      linkModule: 'user-activity',
      status: 'loaded',
    },
    {
      id: 'card-users',
      label: 'Users Logged In',
      value: loggedInUsers,
      context: `${runtimeUsers.filter((u) => u.status === 'active').length} active accounts`,
      linkModule: 'users',
      status: 'loaded',
    },
    {
      id: 'card-credits',
      label: 'API Credits Remaining',
      // TODO(backend): warning threshold comes from backend configuration — never hardcoded
      value: runtimeSettings.credits.current_credits,
      context: runtimeSettings.credits.credits_last_refreshed
        ? `Refreshed ${new Date(runtimeSettings.credits.credits_last_refreshed).toLocaleDateString()}`
        : null,
      linkModule: 'settings',
      status: 'loaded',
    },
    {
      id: 'card-import',
      label: 'Latest Bulk Import',
      value: lastImport ? `${lastImport.rows_inserted.toLocaleString()} rows` : null,
      context: lastImport
        ? `${lastImport.filename} — ${lastImport.status}`
        : 'No imports yet',
      linkModule: 'import-export',
      status: 'loaded',
      badgeVariant: lastImport?.status === 'complete' ? 'outline' : lastImport?.status === 'failed' ? 'destructive' : 'secondary',
      badgeLabel: lastImport?.status ?? undefined,
    },
  ];
}

// Deterministic failure fixture: simulates one card endpoint failing
export async function getDashboardCardById(id: string): Promise<DashboardCardData> {
  await delay(350);
  if (id === 'card-credits-fail.test') {
    throw new Error('Endpoint unavailable');
  }
  const cards = await getDashboardCards();
  return cards.find((c) => c.id === id) ?? { id, label: 'Unknown', value: null, context: null, linkModule: null, status: 'unavailable' };
}

export async function getDashboardActivity(): Promise<DashboardActivity[]> {
  await delay(300);
  return MOCK_DASHBOARD_ACTIVITY;
}

// ── User Activity ─────────────────────────────────────────────────────────────

export async function getUserActivityLogs(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: ActivityLog[]; pagination: PaginationState }> {
  await delay(400);
  let data = MOCK_ACTIVITY_LOGS;
  if (filter) {
    const q = filter.toLowerCase();
    data = data.filter(
      (l) =>
        l.user_display.toLowerCase().includes(q) ||
        l.action_type.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q)
    );
  }
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

export async function getReachRequests(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: ReachRequest[]; pagination: PaginationState }> {
  await delay(350);
  let data = MOCK_REACH_REQUESTS;
  if (filter) {
    const q = filter.toLowerCase();
    data = data.filter(
      (r) => r.domain_name.includes(q) || r.requested_by.includes(q) || r.status.includes(q)
    );
  }
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: UserRecord[]; pagination: PaginationState }> {
  await delay(350);
  let data = runtimeUsers;
  if (filter) {
    const q = filter.toLowerCase();
    data = data.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.role.includes(q)
    );
  }
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

export async function addUser(
  data: { email: string; name: string; role: Role }
): Promise<UserRecord> {
  await delay(500);
  const existing = runtimeUsers.find((u) => u.email === data.email);
  if (existing) throw new Error('A user with this email already exists.');
  const newUser: UserRecord = {
    id: `usr-${Date.now()}`,
    email: data.email,
    name: data.name,
    role: data.role,
    status: 'active',
    last_login: null,
    created_at: new Date().toISOString(),
  };
  runtimeUsers = [newUser, ...runtimeUsers];
  return newUser;
}

export async function updateUser(
  id: string,
  updates: Partial<{ name: string; role: Role; status: UserStatus }>
): Promise<UserRecord> {
  await delay(400);
  const idx = runtimeUsers.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('User not found.');
  const updated = { ...runtimeUsers[idx], ...updates };
  runtimeUsers = runtimeUsers.map((u) => (u.id === id ? updated : u));
  return updated;
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export async function getLogs(
  type: LogType,
  page: number = 1,
  pageSize: number = 50,
  filter?: string
): Promise<{ data: (ActivityLog | RequestLog | ApiLog | ErrorLog)[]; pagination: PaginationState }> {
  await delay(400);

  let data: (ActivityLog | RequestLog | ApiLog | ErrorLog)[];
  switch (type) {
    case 'activity': data = MOCK_ACTIVITY_LOGS; break;
    case 'request': data = MOCK_REQUEST_LOGS; break;
    case 'api': data = MOCK_API_LOGS; break;
    case 'error': data = MOCK_ERROR_LOGS; break;
    default: data = [];
  }

  if (filter) {
    const q = filter.toLowerCase();
    data = data.filter((entry) =>
      Object.values(entry).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }

  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

// ── Import / Export ───────────────────────────────────────────────────────────

export async function getImportHistory(): Promise<ImportJob[]> {
  await delay(300);
  return runtimeImportJobs;
}

export async function simulateImport(filename: string, sizeBytes: number): Promise<ImportJob> {
  await delay(1200);

  // Deterministic failure fixture
  const isPartial = filename.includes('partial') || filename.includes('error');
  const totalRows = Math.floor(sizeBytes / 250);
  const invalidRows = isPartial ? 3 : 0;

  const job: ImportJob = {
    id: `imp-${Date.now()}`,
    filename,
    file_size_bytes: sizeBytes,
    total_rows: totalRows,
    valid_rows: totalRows - invalidRows,
    invalid_rows: invalidRows,
    status: 'validation_complete',
    rows_inserted: 0,
    rows_rejected: 0,
    validation_errors: isPartial
      ? [
          { row: 14, field: 'domain_name', reason: 'Invalid domain format' },
          { row: 87, field: 'reach_value', reason: 'Value must be a positive integer' },
          { row: 203, field: 'domain_name', reason: 'Domain cannot be empty' },
        ]
      : [],
    started_at: new Date().toISOString(),
    completed_at: null,
  };
  runtimeImportJobs = [job, ...runtimeImportJobs];
  return job;
}

export async function confirmImport(jobId: string): Promise<ImportJob> {
  await delay(1500);
  const idx = runtimeImportJobs.findIndex((j) => j.id === jobId);
  if (idx === -1) throw new Error('Import job not found.');
  const job = runtimeImportJobs[idx];
  const completed: ImportJob = {
    ...job,
    status: 'complete',
    rows_inserted: job.valid_rows,
    rows_rejected: job.invalid_rows,
    completed_at: new Date().toISOString(),
  };
  runtimeImportJobs = runtimeImportJobs.map((j) => (j.id === jobId ? completed : j));
  return completed;
}

export async function exportData(
  format: ExportFormat
): Promise<{ filename: string; size_bytes: number }> {
  await delay(1000);
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  return {
    filename: `reacher_export_${new Date().toISOString().slice(0, 10)}.${ext}`,
    size_bytes: 48200,
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  await delay(200);
  return runtimeNotifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await delay(100);
  runtimeNotifications = runtimeNotifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  await delay(150);
  runtimeNotifications = runtimeNotifications.map((n) => ({ ...n, read: true }));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SettingsConfig> {
  await delay(300);
  return runtimeSettings;
}

export async function saveSettings(
  section: keyof SettingsConfig,
  updates: Partial<SettingsConfig[keyof SettingsConfig]>
): Promise<SettingsConfig> {
  await delay(500);
  runtimeSettings = {
    ...runtimeSettings,
    [section]: { ...runtimeSettings[section], ...updates },
  };
  return runtimeSettings;
}
