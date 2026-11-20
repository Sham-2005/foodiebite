-- ==============================================================================
-- FOODIEBITE SUPABASE STORAGE & MEDICAL REPORTS SECURITY HARDENING
-- Migration: 20261118000007_storage_and_medical_reports_hardening.sql
-- Description:
--   1. Ensures private 'medical-reports' storage bucket exists.
--   2. Configures Storage RLS policies enforcing tenant isolation:
--      Only owner can upload, view, update, and delete files in {user_id}/* folder.
--   3. Confirms table constraints & RLS on public.medical_reports and public.health_profiles.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STORAGE BUCKET: medical-reports (Private)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-reports',
    'medical-reports',
    false,
    20971520, -- 20 MB max file size
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[];

-- ------------------------------------------------------------------------------
-- 2. STORAGE ROW LEVEL SECURITY POLICIES
-- Path format: {user_id}/{report_id}-{filename}
-- (storage.foldername(name))[1] resolves to {user_id}
-- ------------------------------------------------------------------------------

-- Allow authenticated users to upload files to their own user directory
DROP POLICY IF EXISTS "medical_reports_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_insert_own" ON storage.objects;
CREATE POLICY "medical_reports_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to view/download their own medical files
DROP POLICY IF EXISTS "medical_reports_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_select_own" ON storage.objects;
CREATE POLICY "medical_reports_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to update their own medical files
DROP POLICY IF EXISTS "medical_reports_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_update_own" ON storage.objects;
CREATE POLICY "medical_reports_update_own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to delete their own medical files
DROP POLICY IF EXISTS "medical_reports_storage_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_delete_own" ON storage.objects;
CREATE POLICY "medical_reports_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ------------------------------------------------------------------------------
-- 3. MEDICAL REPORTS TABLE CONSTRAINTS & RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.medical_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_reports_select_own" ON public.medical_reports;
CREATE POLICY "medical_reports_select_own"
    ON public.medical_reports FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_reports_insert_own" ON public.medical_reports;
CREATE POLICY "medical_reports_insert_own"
    ON public.medical_reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_reports_update_own" ON public.medical_reports;
CREATE POLICY "medical_reports_update_own"
    ON public.medical_reports FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_reports_delete_own" ON public.medical_reports;
CREATE POLICY "medical_reports_delete_own"
    ON public.medical_reports FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. HEALTH PROFILES TABLE RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.health_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_profiles_select_own" ON public.health_profiles;
CREATE POLICY "health_profiles_select_own"
    ON public.health_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "health_profiles_insert_own" ON public.health_profiles;
CREATE POLICY "health_profiles_insert_own"
    ON public.health_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "health_profiles_update_own" ON public.health_profiles;
CREATE POLICY "health_profiles_update_own"
    ON public.health_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "health_profiles_delete_own" ON public.health_profiles;
CREATE POLICY "health_profiles_delete_own"
    ON public.health_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());
