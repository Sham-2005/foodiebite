-- ==============================================================================
-- FOODIEBITE SUPABASE: PHASE 2 AUTHENTICATION FOUNDATION MIGRATION (REVISED)
-- Migration: 20261102000005_auth_foundation.sql
-- Target: PostgreSQL 15+ (Supabase)
-- Purpose: Schema, Triggers, RLS, and Activity Logging for Supabase Auth
-- Security Rules:
--   1. Strict single-admin enforcement: Only sham111205s@gmail.com can be admin.
--   2. Privilege escalation prevention: Regular users cannot change role/status.
--   3. Automated profile provisioning on auth.users registration.
--   4. Exact UUID matching between auth.users and public.profiles.
--   5. Audit-grade login/logout activity tracking.
--   6. Zero exposure of passwords or credentials.
--   7. 100% Idempotent and compatible with migrations 001-004.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USER PROFILES TABLE (Idempotent Definition & Missing Column Synchronization)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    firebase_uid TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    profile_picture_url TEXT,
    phone_number TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'merchant')),
    diet_type TEXT DEFAULT 'Vegetarian',
    age INTEGER CHECK (age IS NULL OR (age >= 1 AND age <= 130)),
    gender TEXT,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled', 'suspended', 'pending')),
    auth_provider TEXT DEFAULT 'email',
    preferences JSONB NOT NULL DEFAULT '{
        "dietType": "Vegetarian",
        "spiceLevel": "Medium",
        "cuisines": ["indian"],
        "healthGoals": ["healthy_eating"],
        "allergies": [],
        "country": "in",
        "minGrade": "c"
    }'::jsonb,
    notification_settings JSONB NOT NULL DEFAULT '{
        "dailySuggestions": true,
        "deliveryTime": "07:00",
        "frequency": "daily",
        "loginAlerts": true,
        "marketingEmails": false
    }'::jsonb,
    last_login_at TIMESTAMPTZ,
    last_sign_in_time TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure newly requested fields are synchronized if table previously existed from 001_core_schema.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Normalize gender check constraint to accept both lowercase and title-case from UI
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check 
    CHECK (gender IS NULL OR LOWER(gender) IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- 3. AUTHENTICATION ACTIVITY LOGS TABLE
-- Tracks login, logout, OAuth, and session events without storing credentials
CREATE TABLE IF NOT EXISTS public.auth_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'login_success',
            'logout_explicit',
            'token_refreshed',
            'password_reset_requested',
            'password_reset_completed',
            'signup_completed',
            'login_failed',
            'session_expired'
        )
    ),
    provider TEXT NOT NULL DEFAULT 'email' CHECK (provider IN ('email', 'google', 'apple', 'anonymous', 'system')),
    platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios', 'backend', 'unknown')),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STRICT IS_ADMIN FUNCTION
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
    SELECT COALESCE(
        (
            auth.uid() IS NOT NULL
            AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'sham111205s@gmail.com'
            AND EXISTS (
                SELECT 1
                FROM public.profiles
                WHERE id = auth.uid()
                  AND LOWER(email) = 'sham111205s@gmail.com'
                  AND role = 'admin'
                  AND disabled = FALSE
                  AND account_status = 'active'
            )
        ),
        FALSE
    );
$$;

-- 5. PROFILE PRIVILEGE ESCALATION PREVENTION TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Security Violation: Modifying user role is restricted to administrators.';
        END IF;
        IF NEW.disabled IS DISTINCT FROM OLD.disabled THEN
            RAISE EXCEPTION 'Security Violation: Modifying account disabled status is restricted to administrators.';
        END IF;
        IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
            RAISE EXCEPTION 'Security Violation: Modifying account status is restricted to administrators.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 6. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. AUTOMATED PROFILE PROVISIONING TRIGGER (handle_new_user)
-- Hooks into auth.users AFTER INSERT.
-- Automatically maps exact UUID from auth.users.id -> public.profiles.id.
-- Enforces role = 'user' for all normal registrations.
-- Only sham111205s@gmail.com is granted role = 'admin'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_email TEXT;
    v_role TEXT;
    v_full_name TEXT;
    v_provider TEXT;
    v_avatar TEXT;
    v_phone TEXT;
    v_age INTEGER;
    v_gender TEXT;
BEGIN
    IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
        v_clean_email := LOWER(TRIM(NEW.email));
    ELSE
        v_clean_email := 'user_' || REPLACE(NEW.id::text, '-', '') || '@placeholder.supabase.co';
    END IF;

    -- Strict admin assignment (Only sham111205s@gmail.com is authorized admin)
    -- Frontend metadata role is strictly ignored
    IF v_clean_email = 'sham111205s@gmail.com' THEN
        v_role := 'admin';
    ELSE
        v_role := 'user';
    END IF;

    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(v_clean_email, '@', 1)
    );

    v_provider := COALESCE(
        NEW.raw_app_meta_data->>'provider',
        NEW.raw_user_meta_data->>'provider',
        'email'
    );

    v_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NEW.raw_user_meta_data->>'photoURL',
        ''
    );

    v_phone := COALESCE(
        NEW.phone,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'phone_number'
    );

    v_age := NULL;
    IF (NEW.raw_user_meta_data->>'age') ~ '^[0-9]+$' THEN
        v_age := (NEW.raw_user_meta_data->>'age')::INTEGER;
        IF v_age < 1 OR v_age > 130 THEN
            v_age := NULL;
        END IF;
    END IF;

    v_gender := NULL;
    IF NEW.raw_user_meta_data->>'gender' IS NOT NULL 
       AND LOWER(TRIM(NEW.raw_user_meta_data->>'gender')) IN ('male', 'female', 'other', 'prefer_not_to_say') THEN
        v_gender := LOWER(TRIM(NEW.raw_user_meta_data->>'gender'));
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        name,
        avatar_url,
        profile_picture_url,
        phone_number,
        role,
        diet_type,
        age,
        gender,
        account_status,
        disabled,
        auth_provider,
        preferences,
        notification_settings,
        last_login_at,
        last_sign_in_time,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_clean_email,
        v_full_name,
        v_full_name,
        v_avatar,
        v_avatar,
        v_phone,
        v_role,
        COALESCE(NEW.raw_user_meta_data->>'dietType', 'Vegetarian'),
        v_age,
        v_gender,
        'active',
        FALSE,
        v_provider,
        COALESCE(NEW.raw_user_meta_data->'preferences', '{
            "dietType": "Vegetarian",
            "spiceLevel": "Medium",
            "cuisines": ["indian"],
            "healthGoals": ["healthy_eating"],
            "allergies": [],
            "country": "in",
            "minGrade": "c"
        }'::jsonb),
        '{
            "dailySuggestions": true,
            "deliveryTime": "07:00",
            "frequency": "daily",
            "loginAlerts": true,
            "marketingEmails": false
        }'::jsonb,
        NOW(),
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        age = COALESCE(EXCLUDED.age, public.profiles.age),
        gender = COALESCE(EXCLUDED.gender, public.profiles.gender),
        last_login_at = NOW(),
        last_active_at = NOW();

    -- Also record signup activity event
    INSERT INTO public.auth_activity_logs (
        user_id,
        event_type,
        provider,
        platform,
        metadata
    ) VALUES (
        NEW.id,
        'signup_completed',
        v_provider,
        COALESCE(NEW.raw_user_meta_data->>'platform', 'web'),
        jsonb_build_object('email', v_clean_email, 'signup_at', NOW())
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 8. SECURE RPC TO LOG AUTHENTICATION ACTIVITY
-- Allows the frontend application to log login/logout events safely
CREATE OR REPLACE FUNCTION public.log_auth_event(
    p_event_type TEXT,
    p_provider TEXT DEFAULT 'email',
    p_platform TEXT DEFAULT 'web',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_log_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: Unable to log event for unauthenticated session.';
    END IF;

    -- Validate event type
    IF p_event_type NOT IN (
        'login_success',
        'logout_explicit',
        'token_refreshed',
        'password_reset_requested',
        'password_reset_completed',
        'signup_completed',
        'login_failed',
        'session_expired'
    ) THEN
        RAISE EXCEPTION 'Invalid auth event type: %', p_event_type;
    END IF;

    INSERT INTO public.auth_activity_logs (
        user_id,
        event_type,
        provider,
        platform,
        metadata,
        created_at
    ) VALUES (
        v_user_id,
        p_event_type,
        p_provider,
        p_platform,
        p_metadata,
        NOW()
    )
    RETURNING id INTO v_log_id;

    -- Update last login/active on user profile
    IF p_event_type = 'login_success' THEN
        UPDATE public.profiles
        SET last_login_at = NOW(),
            last_sign_in_time = NOW(),
            last_active_at = NOW(),
            auth_provider = p_provider
        WHERE id = v_user_id;
    ELSIF p_event_type = 'logout_explicit' THEN
        UPDATE public.profiles
        SET last_active_at = NOW()
        WHERE id = v_user_id;
    END IF;

    RETURN v_log_id;
END;
$$;

-- Grant execute permissions strictly to authenticated users
GRANT EXECUTE ON FUNCTION public.log_auth_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auth_event(TEXT, TEXT, TEXT, JSONB) FROM anon;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_activity_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- PROFILES POLICIES
-- ─────────────────────────────────────────────────────────────

-- SELECT: Users can view their own profile; Admin can view all profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR public.is_admin()
    );

-- UPDATE: Users can update their own profile; Admin can update all
-- (trg_prevent_privilege_escalation prevents users from updating role/disabled/status)
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id
        OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = id
        OR public.is_admin()
    );

-- INSERT: Explicitly drop any previous direct insert policies to avoid OR-merge vulnerabilities
-- Ordinary user profiles are created strictly by handle_new_user() trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
CREATE POLICY "profiles_insert_admin_only"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
    );

-- DELETE: Strictly restricted to Admin
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
    );

-- ─────────────────────────────────────────────────────────────
-- AUTH ACTIVITY LOGS POLICIES
-- ─────────────────────────────────────────────────────────────

-- SELECT: Users can only see their own activity; Admin can view all
DROP POLICY IF EXISTS "auth_activity_select_own_or_admin" ON public.auth_activity_logs;
CREATE POLICY "auth_activity_select_own_or_admin"
    ON public.auth_activity_logs FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.is_admin()
    );

-- INSERT: Authenticated users can insert their own events (or via log_auth_event RPC)
DROP POLICY IF EXISTS "auth_activity_insert_own" ON public.auth_activity_logs;
CREATE POLICY "auth_activity_insert_own"
    ON public.auth_activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

-- NO direct UPDATE or DELETE on auth activity logs (Append-only audit trail)

-- 10. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_lower_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status, disabled);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_activity_user_id ON public.auth_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_activity_created_at ON public.auth_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_event_type ON public.auth_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_activity_user_event ON public.auth_activity_logs(user_id, event_type, created_at DESC);
