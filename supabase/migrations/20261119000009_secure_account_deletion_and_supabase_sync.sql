-- ─────────────────────────────────────────────────────────────
--  FoodieBite — Supabase PostgreSQL Migration 20261119000009
--  Secure Account Deletion, Centralized Persistence & RLS Hardening
-- ─────────────────────────────────────────────────────────────

-- 1. PROFILES RLS: Allow users to delete their own profile OR admin to delete
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_delete_own_or_admin"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin());

-- 2. USER FEEDBACK RLS: Allow authenticated & anon insertion, and admin full management
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_authenticated" ON public.user_feedback;
DROP POLICY IF EXISTS "feedback_insert_anon" ON public.user_feedback;
DROP POLICY IF EXISTS "feedback_select_own_or_admin" ON public.user_feedback;
DROP POLICY IF EXISTS "feedback_admin_all" ON public.user_feedback;

CREATE POLICY "feedback_insert_authenticated"
    ON public.user_feedback FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "feedback_insert_anon"
    ON public.user_feedback FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);

CREATE POLICY "feedback_select_own_or_admin"
    ON public.user_feedback FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "feedback_admin_all"
    ON public.user_feedback FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. RESTAURANT REQUESTS RLS: Allow merchants to insert and view own, and admin to manage
ALTER TABLE public.restaurant_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_requests_insert_own" ON public.restaurant_requests;
DROP POLICY IF EXISTS "restaurant_requests_select_own_or_admin" ON public.restaurant_requests;
DROP POLICY IF EXISTS "restaurant_requests_admin_modify" ON public.restaurant_requests;

CREATE POLICY "restaurant_requests_insert_own"
    ON public.restaurant_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "restaurant_requests_select_own_or_admin"
    ON public.restaurant_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

CREATE POLICY "restaurant_requests_admin_modify"
    ON public.restaurant_requests FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. ATOMIC USER ACCOUNT DELETION FUNCTION (Self-Service)
-- Runs with SECURITY DEFINER to purge Storage objects, application records, and auth.users
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated: cannot delete account without active session';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    -- Block deletion of primary admin account
    IF v_email = 'sham111205s@gmail.com' THEN
        RAISE EXCEPTION 'Operation blocked: Primary system administrator account cannot be deleted';
    END IF;

    -- A. Purge user's physical files from storage.objects bucket 'medical-reports'
    DELETE FROM storage.objects
    WHERE bucket_id = 'medical-reports'
      AND (storage.foldername(name))[1] = v_user_id::text;

    -- B. Explicitly delete user-owned records from all application tables
    DELETE FROM public.medical_reports WHERE user_id = v_user_id;
    DELETE FROM public.health_profiles WHERE user_id = v_user_id;
    DELETE FROM public.user_deficiencies WHERE user_id = v_user_id;
    DELETE FROM public.user_favorites WHERE user_id = v_user_id;
    DELETE FROM public.user_search_history WHERE user_id = v_user_id;
    DELETE FROM public.user_meal_logs WHERE user_id = v_user_id;
    DELETE FROM public.user_gamification WHERE user_id = v_user_id;
    DELETE FROM public.user_login_history WHERE user_id = v_user_id;
    DELETE FROM public.user_activity_logs WHERE user_id = v_user_id;
    DELETE FROM public.coach_messages WHERE thread_id IN (SELECT id FROM public.coach_threads WHERE user_id = v_user_id);
    DELETE FROM public.coach_threads WHERE user_id = v_user_id;
    DELETE FROM public.user_feedback WHERE user_id = v_user_id;
    DELETE FROM public.email_delivery_logs WHERE user_id = v_user_id;
    DELETE FROM public.email_preferences WHERE user_id = v_user_id;
    DELETE FROM public.user_activity WHERE user_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- C. Delete from auth.users (cascades sessions, identities, MFA)
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_user_id', v_user_id,
        'email', v_email,
        'timestamp', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 5. ATOMIC ADMIN USER DELETION FUNCTION (Administrator Service)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
    v_admin_id UUID;
    v_target_email TEXT;
BEGIN
    v_admin_id := auth.uid();
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Only authorized administrators may delete user accounts';
    END IF;

    IF v_admin_id = target_user_id THEN
        RAISE EXCEPTION 'Operation blocked: Cannot delete the currently authenticated administrator account';
    END IF;

    SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
    IF v_target_email = 'sham111205s@gmail.com' THEN
        RAISE EXCEPTION 'Operation blocked: Cannot delete the primary administrator account';
    END IF;

    -- A. Purge user files from storage.objects
    DELETE FROM storage.objects
    WHERE bucket_id = 'medical-reports'
      AND (storage.foldername(name))[1] = target_user_id::text;

    -- B. Explicitly delete user records from all application tables
    DELETE FROM public.medical_reports WHERE user_id = target_user_id;
    DELETE FROM public.health_profiles WHERE user_id = target_user_id;
    DELETE FROM public.user_deficiencies WHERE user_id = target_user_id;
    DELETE FROM public.user_favorites WHERE user_id = target_user_id;
    DELETE FROM public.user_search_history WHERE user_id = target_user_id;
    DELETE FROM public.user_meal_logs WHERE user_id = target_user_id;
    DELETE FROM public.user_gamification WHERE user_id = target_user_id;
    DELETE FROM public.user_login_history WHERE user_id = target_user_id;
    DELETE FROM public.user_activity_logs WHERE user_id = target_user_id;
    DELETE FROM public.coach_messages WHERE thread_id IN (SELECT id FROM public.coach_threads WHERE user_id = target_user_id);
    DELETE FROM public.coach_threads WHERE user_id = target_user_id;
    DELETE FROM public.user_feedback WHERE user_id = target_user_id;
    DELETE FROM public.email_delivery_logs WHERE user_id = target_user_id;
    DELETE FROM public.email_preferences WHERE user_id = target_user_id;
    DELETE FROM public.user_activity WHERE user_id = target_user_id;
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- C. Delete from auth.users
    DELETE FROM auth.users WHERE id = target_user_id;

    -- D. Record audit log in public.admin_audit_logs
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
    VALUES (v_admin_id, 'DELETE_USER', 'user', target_user_id::text, jsonb_build_object('target_email', v_target_email));

    RETURN jsonb_build_object(
        'success', true,
        'deleted_user_id', target_user_id,
        'target_email', v_target_email,
        'timestamp', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
