-- ==============================================================================
-- FOODIEBITE SUPABASE: MISSING APPLICATION TABLES MIGRATION
-- Migration: 20261105000006_missing_application_tables.sql
-- Target: PostgreSQL 15+ (Supabase)
-- Purpose: Create genuinely missing core application tables identified during P1 audit:
--          1. public.user_favorites
--          2. public.user_search_history
--          3. public.coach_threads
--          4. public.coach_messages
--          5. public.medical_reports
--          6. public.health_profiles
-- Security Enforcements:
--   - 100% Row Level Security (RLS) enabled on all 6 tables.
--   - Strict user ownership isolation (auth.uid() = user_id).
--   - Zero public access to medical reports or health metrics.
--   - Designated administrator access governed by public.is_admin().
--   - Cascading referential integrity to public.profiles(id).
--   - High-performance B-tree and GIN indexing for queries & JSONB analysis.
-- ==============================================================================

-- Ensure cryptographic and UUID extensions are present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USER FAVORITES TABLE (public.user_favorites)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    food_name TEXT NOT NULL,
    cuisine TEXT,
    category TEXT,
    food_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_food_favorite UNIQUE (user_id, food_id)
);

-- ==============================================================================
-- 2. USER SEARCH HISTORY TABLE (public.user_search_history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    result_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. AI COACH THREADS TABLE (public.coach_threads)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coach_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nutrition Consultation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. AI COACH MESSAGES TABLE (public.coach_messages)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.coach_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'coach', 'system')),
    text TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'choice', 'alert', 'meal_suggestion')),
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. MEDICAL REPORTS TABLE (public.medical_reports)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.medical_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_name TEXT NOT NULL,
    original_filename TEXT DEFAULT '',
    storage_path TEXT,
    file_url TEXT,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    document_type TEXT NOT NULL DEFAULT 'digital_pdf' CHECK (document_type IN ('digital_pdf', 'scanned_pdf', 'lab_image', 'manual_entry')),
    processing_status TEXT NOT NULL DEFAULT 'completed' CHECK (processing_status IN ('processing', 'completed', 'ocr_failed')),
    ocr_confidence NUMERIC(5,2) DEFAULT 0,
    raw_ocr_text TEXT,
    notes TEXT,
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. HEALTH PROFILES TABLE (public.health_profiles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.health_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 100 CHECK (overall_score BETWEEN 0 AND 100),
    overall_label TEXT NOT NULL DEFAULT 'Good',
    category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    wellness_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
    food_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. TIMESTAMPTZ AUTO-UPDATE TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS trigger_coach_threads_updated_at ON public.coach_threads;
CREATE TRIGGER trigger_coach_threads_updated_at
    BEFORE UPDATE ON public.coach_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_medical_reports_updated_at ON public.medical_reports;
CREATE TRIGGER trigger_medical_reports_updated_at
    BEFORE UPDATE ON public.medical_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 8. INDEXES & QUERY PERFORMANCE OPTIMIZATION
-- ==============================================================================
-- user_favorites indexes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON public.user_favorites(created_at DESC);
CREATE INDEX IF NOT EXISTS gin_user_favorites_food_data ON public.user_favorites USING GIN (food_data);

-- user_search_history indexes
CREATE INDEX IF NOT EXISTS idx_user_search_history_user_chronological ON public.user_search_history(user_id, created_at DESC);

-- coach_threads indexes
CREATE INDEX IF NOT EXISTS idx_coach_threads_user_updated ON public.coach_threads(user_id, updated_at DESC);

-- coach_messages indexes
CREATE INDEX IF NOT EXISTS idx_coach_messages_user_id ON public.coach_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread_chronological ON public.coach_messages(thread_id, created_at ASC);

-- medical_reports indexes
CREATE INDEX IF NOT EXISTS idx_medical_reports_user_chronological ON public.medical_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gin_medical_reports_extracted ON public.medical_reports USING GIN (extracted_data);
CREATE INDEX IF NOT EXISTS gin_medical_reports_analysis ON public.medical_reports USING GIN (analysis);

-- health_profiles indexes
CREATE INDEX IF NOT EXISTS gin_health_profiles_concerns ON public.health_profiles USING GIN (wellness_concerns);
CREATE INDEX IF NOT EXISTS gin_health_profiles_food ON public.health_profiles USING GIN (food_profile);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) ENFORCEMENT
-- ==============================================================================
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLICIES: user_favorites
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "favorites_select_own" ON public.user_favorites;
CREATE POLICY "favorites_select_own"
    ON public.user_favorites FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "favorites_insert_own" ON public.user_favorites;
CREATE POLICY "favorites_insert_own"
    ON public.user_favorites FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.user_favorites;
CREATE POLICY "favorites_delete_own"
    ON public.user_favorites FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- POLICIES: user_search_history
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "search_history_select_own" ON public.user_search_history;
CREATE POLICY "search_history_select_own"
    ON public.user_search_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "search_history_insert_own" ON public.user_search_history;
CREATE POLICY "search_history_insert_own"
    ON public.user_search_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "search_history_delete_own" ON public.user_search_history;
CREATE POLICY "search_history_delete_own"
    ON public.user_search_history FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- POLICIES: coach_threads
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "coach_threads_select_own" ON public.coach_threads;
CREATE POLICY "coach_threads_select_own"
    ON public.coach_threads FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "coach_threads_insert_own" ON public.coach_threads;
CREATE POLICY "coach_threads_insert_own"
    ON public.coach_threads FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "coach_threads_update_own" ON public.coach_threads;
CREATE POLICY "coach_threads_update_own"
    ON public.coach_threads FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "coach_threads_delete_own" ON public.coach_threads;
CREATE POLICY "coach_threads_delete_own"
    ON public.coach_threads FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- POLICIES: coach_messages
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "coach_messages_select_own" ON public.coach_messages;
CREATE POLICY "coach_messages_select_own"
    ON public.coach_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "coach_messages_insert_own" ON public.coach_messages;
CREATE POLICY "coach_messages_insert_own"
    ON public.coach_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "coach_messages_delete_own" ON public.coach_messages;
CREATE POLICY "coach_messages_delete_own"
    ON public.coach_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- POLICIES: medical_reports (CLINICAL DATA PRIVACY — STRICTLY OWNER ONLY)
-- No public access. No administrative browsing across patient records.
-- ------------------------------------------------------------------------------
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
-- POLICIES: health_profiles (SENSITIVE HEALTH METRICS PRIVACY)
-- ------------------------------------------------------------------------------
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

