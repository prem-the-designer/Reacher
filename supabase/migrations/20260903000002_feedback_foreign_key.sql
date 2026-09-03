-- Re-establish foreign key for PostgREST nested resource joins
ALTER TABLE public.feedback_campaign_versions
  DROP CONSTRAINT IF EXISTS feedback_campaign_versions_campaign_id_fkey;

ALTER TABLE public.feedback_campaign_versions
  ADD CONSTRAINT feedback_campaign_versions_campaign_id_fkey
  FOREIGN KEY (campaign_id)
  REFERENCES public.feedback_campaigns(id)
  ON DELETE CASCADE;
