-- Supabase Full Schema Setup

-- 1. REACH REQUESTS
create table if not exists public.reach_requests (
  id uuid default gen_random_uuid() primary key,
  domain_name text not null,
  requested_by uuid references auth.users not null,
  status text check (status in ('pending', 'processing', 'fulfilled', 'failed')) default 'pending',
  created_at timestamp with time zone default now(),
  fulfilled_at timestamp with time zone
);

alter table public.reach_requests enable row level security;
create policy "Admins can manage reach requests" on reach_requests for all using (public.is_admin());
create policy "Users can view own requests" on reach_requests for select using (auth.uid() = requested_by);

-- 2. ACTIVITY LOGS
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  user_display text,
  action_type text not null,
  resource_type text not null,
  resource_id text,
  details text,
  timestamp timestamp with time zone default now()
);

alter table public.activity_logs enable row level security;
create policy "Admins can view activity logs" on activity_logs for select using (public.is_admin());
create policy "System can insert activity logs" on activity_logs for insert with check (true); -- Usually restricted to service role in prod

-- 3. API LOGS
create table if not exists public.api_logs (
  id uuid default gen_random_uuid() primary key,
  operation text not null,
  resource text not null,
  status text check (status in ('success', 'failed', 'rate_limited')) not null,
  duration_ms integer not null,
  timestamp timestamp with time zone default now()
);

alter table public.api_logs enable row level security;
create policy "Admins can view api logs" on api_logs for select using (public.is_admin());

-- 4. ERROR LOGS
create table if not exists public.error_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default now(),
  error_context text not null,
  related_resource text,
  status text check (status in ('open', 'resolved')) default 'open',
  diagnostic text
);

alter table public.error_logs enable row level security;
create policy "Admins can view and update error logs" on error_logs for all using (public.is_admin());

-- 5. IMPORT JOBS
create table if not exists public.import_jobs (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  file_size_bytes integer not null,
  total_rows integer not null,
  valid_rows integer not null,
  invalid_rows integer not null,
  status text not null,
  rows_inserted integer not null,
  rows_rejected integer not null,
  validation_errors jsonb default '[]'::jsonb,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

alter table public.import_jobs enable row level security;
create policy "Admins can manage import jobs" on import_jobs for all using (public.is_admin());

-- 6. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  title text not null,
  body text not null,
  read boolean default false,
  created_at timestamp with time zone default now(),
  link_module text,
  link_label text
);

alter table public.notifications enable row level security;
create policy "Admins can manage notifications" on notifications for all using (public.is_admin());

-- 7. APP SETTINGS
create table if not exists public.app_settings (
  section text primary key,
  config jsonb not null
);

alter table public.app_settings enable row level security;
create policy "Admins can manage settings" on app_settings for all using (public.is_admin());

-- Insert default settings if they don't exist
insert into public.app_settings (section, config) values 
('api', '{"credential_set": true, "credential_last_updated": "2024-01-01T00:00:00Z"}'::jsonb),
('credits', '{"warning_threshold": 1000, "critical_threshold": 100, "current_credits": 50000, "credits_last_refreshed": "2024-01-01T00:00:00Z"}'::jsonb),
('data_refresh', '{"schedule_description": "Every Monday at 2AM UTC", "last_refresh": "2024-01-01T00:00:00Z", "next_refresh": "2024-01-08T00:00:00Z"}'::jsonb)
on conflict do nothing;
