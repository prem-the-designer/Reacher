-- Fix api_logs insert policy
DROP POLICY IF EXISTS "Users can insert api logs" ON public.api_logs;
CREATE POLICY "Users can insert api logs" ON public.api_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Ensure activity logs insert policy is correct
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Also ensure permissions
GRANT INSERT ON public.api_logs TO authenticated;
GRANT INSERT ON public.activity_logs TO authenticated;
