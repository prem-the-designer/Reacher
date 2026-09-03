-- Reacher Feedback Management V1 Schema
-- Architecture: Campaign -> Version -> Trigger -> Response -> Archive

-- 1. feedback_campaigns
CREATE TABLE IF NOT EXISTS public.feedback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  feedback_type TEXT NOT NULL DEFAULT 'successful_search',
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, archived
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high
  audience TEXT NOT NULL DEFAULT 'analysts',
  trigger_event TEXT NOT NULL DEFAULT 'search_completed',
  frequency_rule TEXT NOT NULL DEFAULT 'every_eligible_search',
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  current_version_id UUID,
  current_version_number INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  archived_by TEXT,
  archive_reason TEXT,
  previous_status TEXT
);

-- 2. feedback_campaign_versions
CREATE TABLE IF NOT EXISTS public.feedback_campaign_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.feedback_campaigns(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL, -- e.g. "v1"
  question TEXT NOT NULL DEFAULT 'Was this result useful?',
  response_type TEXT NOT NULL DEFAULT 'yes_no',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, deprecated
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(campaign_id, version_number)
);

-- 3. feedback_responses
CREATE TABLE IF NOT EXISTS public.feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  campaign_version_id UUID NOT NULL,
  campaign_name TEXT,
  version_label TEXT,
  user_id UUID NOT NULL,
  user_name TEXT,
  search_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'successful_search',
  rating TEXT NOT NULL, -- positive, negative
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT,
  domain TEXT NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feedback_user_search_type UNIQUE(user_id, search_id, feedback_type)
);

-- 4. feedback_audit_logs
CREATE TABLE IF NOT EXISTS public.feedback_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- campaign, version, response, settings
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL, -- created, edited, draft_saved, version_created, published, paused, archived, restored, duplicated, settings_changed
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_fb_campaigns_status ON public.feedback_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_fb_versions_campaign ON public.feedback_campaign_versions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_responses_search ON public.feedback_responses(search_id);
CREATE INDEX IF NOT EXISTS idx_fb_responses_campaign ON public.feedback_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_audit_entity ON public.feedback_audit_logs(entity_id);

-- Enable RLS
ALTER TABLE public.feedback_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_campaign_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write through anon key (or service role) as configured in Reacher
CREATE POLICY "Public full access to feedback_campaigns" ON public.feedback_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to feedback_campaign_versions" ON public.feedback_campaign_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to feedback_responses" ON public.feedback_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to feedback_audit_logs" ON public.feedback_audit_logs FOR ALL USING (true) WITH CHECK (true);
