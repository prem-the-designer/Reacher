/**
 * Admin API Service
 * The ONLY layer that knows about transport.
 * Connected to Supabase backend.
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

import { supabase } from '@/lib/supabase';

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardCards(): Promise<DashboardCardData[]> {
  // 1. Pending requests count
  const { count: pendingRequests } = await supabase
    .from('reach_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: processingRequests } = await supabase
    .from('reach_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');

  // 2. Active users count
  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: loggedInUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .not('last_login', 'is', null);

  // 3. Settings (Credits)
  const { data: creditsData } = await supabase
    .from('app_settings')
    .select('config')
    .eq('section', 'credits')
    .single();

  const credits = creditsData?.config || {};

  // 4. Last Import Job
  const { data: lastImportData } = await supabase
    .from('import_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return [
    {
      id: 'card-requests',
      label: 'New Reach Value Requests',
      value: pendingRequests ?? 0,
      context: `${processingRequests ?? 0} processing`,
      linkModule: 'user-activity',
      status: 'loaded',
    },
    {
      id: 'card-users',
      label: 'Users Logged In',
      value: loggedInUsers ?? 0,
      context: `${activeUsers ?? 0} active accounts`,
      linkModule: 'users',
      status: 'loaded',
    },
    {
      id: 'card-credits',
      label: 'API Credits Remaining',
      value: credits.current_credits ?? null,
      context: credits.credits_last_refreshed
        ? `Refreshed ${new Date(credits.credits_last_refreshed).toLocaleDateString()}`
        : null,
      linkModule: 'settings',
      status: 'loaded',
    },
    {
      id: 'card-import',
      label: 'Latest Bulk Import',
      value: lastImportData ? `${lastImportData.rows_inserted.toLocaleString()} rows` : null,
      context: lastImportData
        ? `${lastImportData.filename} — ${lastImportData.status}`
        : 'No imports yet',
      linkModule: 'import-export',
      status: 'loaded',
      badgeVariant: lastImportData?.status === 'complete' ? 'outline' : lastImportData?.status === 'failed' ? 'destructive' : 'secondary',
      badgeLabel: lastImportData?.status ?? undefined,
    },
  ];
}

export async function getDashboardCardById(id: string): Promise<DashboardCardData> {
  const cards = await getDashboardCards();
  return cards.find((c) => c.id === id) ?? { id, label: 'Unknown', value: null, context: null, linkModule: null, status: 'unavailable' };
}

export async function getDashboardActivity(): Promise<DashboardActivity[]> {
  // Aggregate recent activity across tables for dashboard
  const { data: requests } = await supabase.from('reach_requests').select('id, domain_name, created_at').order('created_at', { ascending: false }).limit(3);
  const { data: imports } = await supabase.from('import_jobs').select('id, filename, started_at').order('started_at', { ascending: false }).limit(2);
  const { data: profiles } = await supabase.from('profiles').select('id, email, created_at').order('created_at', { ascending: false }).limit(2);

  const combined: DashboardActivity[] = [
    ...(requests || []).map((r: any) => ({ id: r.id, description: `Requested domain: ${r.domain_name}`, timestamp: r.created_at, category: 'request' as const })),
    ...(imports || []).map((i: any) => ({ id: i.id, description: `Started import: ${i.filename}`, timestamp: i.started_at, category: 'import' as const })),
    ...(profiles || []).map((p: any) => ({ id: p.id, description: `New user signed up: ${p.email}`, timestamp: p.created_at, category: 'user' as const }))
  ];

  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return combined.slice(0, 5);
}

// ── User Activity ─────────────────────────────────────────────────────────────

export async function getUserActivityLogs(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: ActivityLog[]; pagination: PaginationState }> {
  let query = supabase.from('activity_logs').select('*', { count: 'exact' });

  if (filter) {
    query = query.or(`user_display.ilike.%${filter}%,action_type.ilike.%${filter}%,resource_type.ilike.%${filter}%`);
  }

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.order('timestamp', { ascending: false }).range(start, start + pageSize - 1);

  if (error) throw new Error(error.message);
  return { data: data as ActivityLog[], pagination: { page, pageSize, total: count || 0 } };
}

export async function getReachRequests(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: ReachRequest[]; pagination: PaginationState }> {
  let query = supabase.from('reach_requests').select('*', { count: 'exact' });

  if (filter) {
    query = query.or(`domain_name.ilike.%${filter}%,status.ilike.%${filter}%`);
  }

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(start, start + pageSize - 1);

  if (error) throw new Error(error.message);
  return { data: data as ReachRequest[], pagination: { page, pageSize, total: count || 0 } };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(
  page: number = 1,
  pageSize: number = 25,
  filter?: string
): Promise<{ data: UserRecord[]; pagination: PaginationState }> {
  let query = supabase.from('profiles').select('*', { count: 'exact' });

  if (filter) {
    query = query.or(`email.ilike.%${filter}%,name.ilike.%${filter}%`);
  }

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(start, start + pageSize - 1);

  if (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users');
  }

  return {
    data: data as UserRecord[],
    pagination: { page, pageSize, total: count || 0 }
  };
}

export async function addUser(
  _data: { email: string; name: string; role: Role }
): Promise<UserRecord> {
  throw new Error('Users must sign in via Google OAuth first to request access.');
}

export async function updateUser(
  id: string,
  updates: Partial<{ name: string; role: Role; status: UserStatus }>
): Promise<UserRecord> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }

  return data as UserRecord;
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export async function getLogs(
  type: LogType,
  page: number = 1,
  pageSize: number = 50,
  filter?: string
): Promise<{ data: (ActivityLog | RequestLog | ApiLog | ErrorLog)[]; pagination: PaginationState }> {
  let table = '';
  switch (type) {
    case 'activity': table = 'activity_logs'; break;
    case 'request': table = 'reach_requests'; break;
    case 'api': table = 'api_logs'; break;
    case 'error': table = 'error_logs'; break;
  }

  let query = supabase.from(table).select('*', { count: 'exact' });

  if (filter) {
    // Basic catch-all filter logic based on table text columns
    if (table === 'activity_logs') query = query.or(`action_type.ilike.%${filter}%,details.ilike.%${filter}%`);
    if (table === 'reach_requests') query = query.or(`domain_name.ilike.%${filter}%`);
    if (table === 'api_logs') query = query.or(`operation.ilike.%${filter}%,resource.ilike.%${filter}%`);
    if (table === 'error_logs') query = query.or(`error_context.ilike.%${filter}%,diagnostic.ilike.%${filter}%`);
  }

  const start = (page - 1) * pageSize;
  // Fallback sort columns depending on table
  const sortCol = table === 'reach_requests' ? 'created_at' : table === 'activity_logs' ? 'timestamp' : table === 'api_logs' ? 'timestamp' : 'timestamp';
  const { data, error, count } = await query.order(sortCol, { ascending: false }).range(start, start + pageSize - 1);

  if (error) throw new Error(error.message);
  return { data: data as any[], pagination: { page, pageSize, total: count || 0 } };
}

// ── Import / Export ───────────────────────────────────────────────────────────

export async function getImportHistory(): Promise<ImportJob[]> {
  const { data, error } = await supabase.from('import_jobs').select('*').order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as ImportJob[];
}

export async function simulateImport(filename: string, sizeBytes: number): Promise<ImportJob> {
  const totalRows = Math.floor(sizeBytes / 250);
  const { data, error } = await supabase.from('import_jobs').insert({
    filename,
    file_size_bytes: sizeBytes,
    total_rows: totalRows,
    valid_rows: totalRows,
    invalid_rows: 0,
    status: 'validation_complete',
    rows_inserted: 0,
    rows_rejected: 0,
    validation_errors: []
  }).select().single();

  if (error) throw new Error(error.message);
  return data as ImportJob;
}

export async function confirmImport(jobId: string): Promise<ImportJob> {
  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single();
  if (!job) throw new Error('Job not found');

  const { data, error } = await supabase.from('import_jobs').update({
    status: 'complete',
    rows_inserted: job.valid_rows,
    rows_rejected: job.invalid_rows,
    completed_at: new Date().toISOString()
  }).eq('id', jobId).select().single();

  if (error) throw new Error(error.message);
  return data as ImportJob;
}

export async function exportData(
  format: ExportFormat
): Promise<{ filename: string; size_bytes: number }> {
  // In a real app, this would trigger an Edge Function to generate the export
  return {
    filename: `reacher_export_${new Date().toISOString().slice(0, 10)}.${format}`,
    size_bytes: Math.floor(Math.random() * 50000) + 10000,
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('read', false);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SettingsConfig> {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw new Error(error.message);

  const config: any = {};
  data.forEach(row => {
    config[row.section] = row.config;
  });

  return config as SettingsConfig;
}

export async function saveSettings(
  section: keyof SettingsConfig,
  updates: Partial<SettingsConfig[keyof SettingsConfig]>
): Promise<SettingsConfig> {
  // First get current config for this section
  const { data: current } = await supabase.from('app_settings').select('config').eq('section', section).single();
  const currentConfig = current?.config || {};

  const newConfig = { ...currentConfig, ...updates };

  await supabase.from('app_settings').upsert({ section, config: newConfig });
  return getSettings();
}
