-- Migration: 20260903000001_feedback_schema_adjustments.sql
-- 1. Ensure flexible TEXT types for campaign and user IDs to support both UUIDs and custom string IDs

ALTER TABLE public.feedback_responses DROP CONSTRAINT IF EXISTS feedback_responses_campaign_id_fkey;
ALTER TABLE public.feedback_campaign_versions DROP CONSTRAINT IF EXISTS feedback_campaign_versions_campaign_id_fkey;

ALTER TABLE public.feedback_campaigns ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.feedback_campaigns ALTER COLUMN current_version_id TYPE TEXT;

ALTER TABLE public.feedback_campaign_versions ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.feedback_campaign_versions ALTER COLUMN campaign_id TYPE TEXT;

ALTER TABLE public.feedback_responses ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.feedback_responses ALTER COLUMN campaign_id TYPE TEXT;
ALTER TABLE public.feedback_responses ALTER COLUMN campaign_version_id TYPE TEXT;
ALTER TABLE public.feedback_responses ALTER COLUMN user_id TYPE TEXT;

ALTER TABLE public.feedback_audit_logs ALTER COLUMN id TYPE TEXT;

-- 2. Insert Default Active Campaign and Version if not present
INSERT INTO public.feedback_campaigns (
  id,
  name,
  description,
  feedback_type,
  status,
  priority,
  audience,
  trigger_event,
  frequency_rule,
  cooldown_seconds,
  current_version_id,
  current_version_number,
  created_by,
  created_at,
  updated_at,
  published_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Successful Search Feedback',
  'Collect feedback from Analysts after successful single-domain searches.',
  'successful_search',
  'active',
  'normal',
  'analysts',
  'search_completed',
  'every_eligible_search',
  0,
  '00000000-0000-0000-0000-000000000002',
  1,
  'system',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  trigger_event = 'search_completed';

INSERT INTO public.feedback_campaign_versions (
  id,
  campaign_id,
  version_number,
  version_label,
  question,
  response_type,
  configuration,
  status,
  created_by,
  created_at,
  published_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  1,
  'v1',
  'Was this result useful?',
  'yes_no',
  '{
    "positive_label": "Yes",
    "negative_label": "No",
    "negative_reasons": [
      {"id": "reason-1", "label": "The reach value doesn''t look right", "order": 1},
      {"id": "reason-2", "label": "The data is outdated", "order": 2},
      {"id": "reason-3", "label": "I couldn''t understand the result", "order": 3},
      {"id": "reason-4", "label": "I expected more information", "order": 4},
      {"id": "reason-5", "label": "The search took too long", "order": 5},
      {"id": "reason-6", "label": "Something else", "order": 6}
    ],
    "comment_enabled": true,
    "comment_placeholder": "Tell us more (optional)",
    "comment_max_length": 500
  }'::jsonb,
  'published',
  'system',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
