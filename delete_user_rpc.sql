CREATE OR REPLACE FUNCTION public.delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete associated logs and requests to prevent foreign key constraint errors
  DELETE FROM public.activity_logs WHERE user_id = target_user_id;
  DELETE FROM public.reach_requests WHERE requested_by = target_user_id;

  -- Delete the profile
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete the actual auth user
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;