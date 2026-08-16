-- 1. MANUAL REACH VALUES TABLE
create table if not exists public.manual_reach_values (
  id uuid default gen_random_uuid() primary key,
  outlet_name text,
  domain_url text not null,
  media_type text,
  daily_reach bigint,
  monthly_reach bigint,
  reach_value bigint not null, -- Mandatory as requested
  country text,
  state text,
  cpm numeric,
  ad_rate numeric,
  region text,
  category_name text,
  source_type text,
  updated_date timestamp with time zone default now() not null
);

-- Enable RLS for manual_reach_values
alter table public.manual_reach_values enable row level security;
create policy "Admins can manage manual reach values" on manual_reach_values for all using (public.is_admin());
create policy "Analysts can view manual reach values" on manual_reach_values for select using (true); -- Adjust if you want only authenticated users
create policy "Analysts can update manual reach values" on manual_reach_values for update using (auth.role() = 'authenticated');


-- 2. SIMILARWEB REACH FETCH TABLE
create table if not exists public.similarweb_reach (
  id uuid default gen_random_uuid() primary key,
  domain_url text not null,
  reach_value bigint not null, -- Mandatory as requested
  updated_date timestamp with time zone default now() not null
);

-- Enable RLS for similarweb_reach
alter table public.similarweb_reach enable row level security;
create policy "Admins can manage similarweb reach" on similarweb_reach for all using (public.is_admin());
create policy "Analysts can view similarweb reach" on similarweb_reach for select using (true); -- Adjust if you want only authenticated users
create policy "Analysts can manage similarweb reach (insert/update)" on similarweb_reach for all using (auth.role() = 'authenticated');
