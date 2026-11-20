-- ==============================================================================
-- FOODIEBITE AUTOMATED EMAIL SYSTEM MIGRATION
-- Migration: 20261119000008_automated_email_system.sql
-- Description:
--   1. Creates public.email_preferences table with timezone, delivery time, and toggles.
--   2. Creates public.email_delivery_logs table with strict duplicate-prevention unique indexes.
--   3. Configures Row Level Security (RLS) policies for user tenant isolation.
--   4. Creates auto-provisioning triggers on public.profiles.
--   5. Seeds existing user profiles into email_preferences with welcome_email_sent = TRUE
--      to guarantee existing users are never spammed.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EMAIL PREFERENCES TABLE (public.email_preferences)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    welcome_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    daily_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_delivery_time TEXT NOT NULL DEFAULT '09:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    last_daily_email_sent TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on timezone and delivery time for efficient scheduled batch queries
CREATE INDEX IF NOT EXISTS idx_email_prefs_delivery 
    ON public.email_preferences (daily_email_enabled, preferred_delivery_time, timezone)
    WHERE daily_email_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_email_prefs_user_id 
    ON public.email_preferences (user_id);

-- ------------------------------------------------------------------------------
-- 2. EMAIL DELIVERY LOGS TABLE (public.email_delivery_logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL CHECK (email_type IN ('welcome', 'daily_recommendation', 'system_alert', 'password_reset')),
    delivery_date TEXT NOT NULL, -- Format: YYYY-MM-DD
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('delivered', 'sent', 'failed', 'skipped')),
    provider_message_id TEXT,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_user 
    ON public.email_delivery_logs (user_id, email_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_date 
    ON public.email_delivery_logs (delivery_date, email_type);

-- Unique constraint for Welcome emails: exactly ONE successful welcome email per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_delivery_welcome
    ON public.email_delivery_logs (user_id, email_type)
    WHERE email_type = 'welcome' AND status IN ('sent', 'delivered');

-- Unique constraint for Daily Recommendations: exactly ONE successful daily email per user per date
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_delivery_daily_date
    ON public.email_delivery_logs (user_id, email_type, delivery_date)
    WHERE email_type = 'daily_recommendation' AND status IN ('sent', 'delivered');

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- email_preferences RLS
DROP POLICY IF EXISTS "email_preferences_select_own" ON public.email_preferences;
CREATE POLICY "email_preferences_select_own"
    ON public.email_preferences FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "email_preferences_insert_own" ON public.email_preferences;
CREATE POLICY "email_preferences_insert_own"
    ON public.email_preferences FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "email_preferences_update_own" ON public.email_preferences;
CREATE POLICY "email_preferences_update_own"
    ON public.email_preferences FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "email_preferences_delete_own" ON public.email_preferences;
CREATE POLICY "email_preferences_delete_own"
    ON public.email_preferences FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- email_delivery_logs RLS
-- Users can view their own delivery audit logs; only backend/admin can insert/update logs
DROP POLICY IF EXISTS "email_delivery_logs_select_own" ON public.email_delivery_logs;
CREATE POLICY "email_delivery_logs_select_own"
    ON public.email_delivery_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "email_delivery_logs_insert_admin" ON public.email_delivery_logs;
CREATE POLICY "email_delivery_logs_insert_admin"
    ON public.email_delivery_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. AUTO-PROVISIONING TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------------------------
-- Function to automatically provision email_preferences when a new profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.email_preferences (user_id, welcome_email_sent, daily_email_enabled, preferred_delivery_time, timezone)
    VALUES (NEW.id, FALSE, TRUE, '09:00', 'Asia/Kolkata')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_provision_email_preferences ON public.profiles;
CREATE TRIGGER trigger_provision_email_preferences
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_email_preferences();

-- ------------------------------------------------------------------------------
-- 5. SEED EXISTING PROFILES WITH SAFE DEFAULTS
-- Guarantee existing users do not receive unwanted welcome emails upon deployment
-- ------------------------------------------------------------------------------
INSERT INTO public.email_preferences (user_id, welcome_email_sent, daily_email_enabled, preferred_delivery_time, timezone)
SELECT 
    p.id, 
    TRUE, -- Existing users are marked as already having received welcome email
    TRUE, 
    '09:00', 
    'Asia/Kolkata'
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;
