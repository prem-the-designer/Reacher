-- Add INSERT policy for reach_requests so users can log their own requests
DROP POLICY IF EXISTS "Users can insert own requests" ON public.reach_requests;
CREATE POLICY "Users can insert own requests" ON public.reach_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);

-- Ensure INSERT permission is granted
GRANT INSERT ON public.reach_requests TO authenticated;
