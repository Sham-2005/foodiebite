-- ==============================================================================
-- FOODIEBITE SUPABASE MASTER CONSOLIDATED DATABASE FOUNDATION (HARDENED)
-- Target: PostgreSQL 15+ (Supabase)
-- Version: 1.3.0 (Zero RLS Recursion, Hardened Profile Insert & Settings Segregation)
-- 
-- Summary of Security Hardening Applied:
--   1. Zero RLS Recursion on public.profiles: Removed all self-referencing subqueries
--      from 'profiles_update_own_or_admin'. Enforces row ownership via auth.uid() = id
--      and admin check via public.is_admin(); column-level protection (role, disabled,
--      account_status) is enforced in-memory by 'trg_prevent_privilege_escalation'.
--   2. Hardened Profile INSERT: Policy 'profiles_insert_own_restricted' guarantees standard
--      users can only create their own profile with role='user', disabled=FALSE, and
--      account_status='active', preventing self-service admin/merchant assignment.
--   3. System Settings Segregation: Separated public client configuration (is_public=TRUE)
--      from internal settings (is_public=FALSE, admin-only). Secrets are strictly excluded.
--   4. Strict Single-Admin Enforcement: 'is_admin()' strictly checks designated email
--      'sham111205s@gmail.com', verifies active & non-disabled profile state, and
--      completely ignores client-controlled and JWT metadata roles.
--   5. Protected 'cached_foods' and 'email_events': Direct client/public INSERT eliminated;
--      trusted backend services and webhook workers insert via service-role.
--   6. Protected 'email_unsubscribes', 'analytics_events', and 'api_health_pings': Zero open
--      public write policies across the entire schema.
--   7. Full 32-table relational foundation with 100% Firestore collection mapping.
--   8. Idempotent policy declarations with 'DROP POLICY IF EXISTS' before every policy.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: EXTENSIONS & UTILITY FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_email TEXT;
    v_role TEXT;
    v_name TEXT;
BEGIN
    IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
        v_clean_email := LOWER(TRIM(NEW.email));
    ELSE
        v_clean_email := 'user_' || REPLACE(NEW.id::text, '-', '') || '@placeholder.supabase.co';
    END IF;

    IF v_clean_email = 'sham111205s@gmail.com' THEN
        v_role := 'admin';
    ELSE
        v_role := 'user';
    END IF;

    v_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(v_clean_email, '@', 1)
    );

    INSERT INTO public.profiles (
        id,
        firebase_uid,
        email,
        name,
        role,
        diet_type,
        account_status,
        disabled,
        auth_provider,
        preferences,
        notification_settings,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NULL,
        v_clean_email,
        v_name,
        v_role,
        COALESCE(NEW.raw_user_meta_data->>'dietType', 'Vegetarian'),
        'active',
        FALSE,
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
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
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        last_active_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- PART 2: CORE TABLES DEFINITION (32 TABLES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    firebase_uid TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'merchant')),
    diet_type TEXT DEFAULT 'Vegetarian',
    age INTEGER CHECK (age IS NULL OR (age >= 1 AND age <= 130)),
    gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    profile_picture_url TEXT,
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
    last_sign_in_time TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    food_name TEXT NOT NULL,
    cuisine TEXT,
    category TEXT,
    food_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_food_favorite UNIQUE (user_id, food_id)
);

CREATE TABLE IF NOT EXISTS public.user_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    result_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medical_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    document_type TEXT NOT NULL DEFAULT 'digital_pdf' CHECK (document_type IN ('digital_pdf', 'scanned_pdf', 'lab_image', 'manual_entry')),
    processing_status TEXT NOT NULL DEFAULT 'completed' CHECK (processing_status IN ('processing', 'completed', 'ocr_failed')),
    ocr_confidence NUMERIC(5,2) DEFAULT 0,
    raw_ocr_text TEXT,
    notes TEXT,
    extracted_data JSONB NOT NULL DEFAULT '{
        "patientInformation": {},
        "medicalInformation": {},
        "testResults": []
    }'::jsonb,
    analysis JSONB NOT NULL DEFAULT '{
        "biomarkers": {},
        "findings": [],
        "wellnessConcerns": [],
        "healthScores": {},
        "foodProfile": {}
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_medical_reports_updated_at ON public.medical_reports;
CREATE TRIGGER trigger_medical_reports_updated_at
    BEFORE UPDATE ON public.medical_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.health_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 100 CHECK (overall_score BETWEEN 0 AND 100),
    overall_label TEXT NOT NULL DEFAULT 'Good',
    category_scores JSONB NOT NULL DEFAULT '{
        "bloodSugar": 100,
        "heartHealth": 100,
        "vitamins": 100,
        "nutrition": 100,
        "weight": 100,
        "kidneyHealth": 100,
        "liverHealth": 100,
        "hydration": 100,
        "immuneHealth": 100
    }'::jsonb,
    wellness_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
    food_profile JSONB NOT NULL DEFAULT '{
        "foodsToLimit": [],
        "foodsToPrefer": [],
        "recommendedNutrients": []
    }'::jsonb,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_deficiencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nutrient_name TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    detected_level TEXT,
    target_level TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'beverage')),
    food_name TEXT NOT NULL,
    food_id TEXT,
    calories NUMERIC(7,2) DEFAULT 0,
    macros JSONB NOT NULL DEFAULT '{
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0,
        "fiber_g": 0
    }'::jsonb,
    portion_size TEXT DEFAULT '1 serving',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_gamification (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 1,
    longest_streak INTEGER NOT NULL DEFAULT 1,
    total_points INTEGER NOT NULL DEFAULT 0,
    tier_level TEXT NOT NULL DEFAULT 'Bronze Pioneer',
    badges JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_active_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    location_summary TEXT,
    login_status TEXT NOT NULL DEFAULT 'success' CHECK (login_status IN ('success', 'failed', 'blocked')),
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coach_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nutrition Consultation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_coach_threads_updated_at ON public.coach_threads;
CREATE TRIGGER trigger_coach_threads_updated_at
    BEFORE UPDATE ON public.coach_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.coach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.coach_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'coach', 'system')),
    text TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'choice', 'alert', 'meal_suggestion')),
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'recommendation', 'feature_request', 'dietary_safety')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.restaurant_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    restaurant_name TEXT NOT NULL,
    cuisines TEXT[] NOT NULL DEFAULT '{}',
    address TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT NOT NULL,
    dietary_offerings JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.approved_restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.restaurant_requests(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    cuisines TEXT[] NOT NULL DEFAULT '{}',
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.5 CHECK (rating BETWEEN 1.0 AND 5.0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    dietary_tags TEXT[] DEFAULT '{}',
    menu_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cached_foods (
    food_id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE,
    product_name TEXT NOT NULL,
    brands TEXT,
    categories TEXT[] DEFAULT '{}',
    nutriscore_grade TEXT CHECK (nutriscore_grade IS NULL OR nutriscore_grade IN ('a', 'b', 'c', 'd', 'e')),
    nutriments JSONB NOT NULL DEFAULT '{}'::jsonb,
    allergens TEXT[] DEFAULT '{}',
    image_url TEXT,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.daily_recommendation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    total_eligible INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error_summary TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.daily_recommendation_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES public.daily_recommendation_runs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'failed', 'skipped', 'unsubscribed')),
    weather_context JSONB DEFAULT '{}'::jsonb,
    selected_foods JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'canceled')),
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    clicked_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'opened', 'clicked', 'bounced', 'failed')),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
    email TEXT PRIMARY KEY,
    reason TEXT DEFAULT 'user_opt_out',
    unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    anonymous_user_id TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    food_id TEXT,
    recommendation_strategy TEXT,
    experiment_id TEXT,
    variant_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feature_daily_aggregates (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    total_events INTEGER NOT NULL DEFAULT 0,
    recommendation_impressions INTEGER NOT NULL DEFAULT 0,
    recommendation_clicks INTEGER NOT NULL DEFAULT 0,
    food_detail_views INTEGER NOT NULL DEFAULT 0,
    favorites_added INTEGER NOT NULL DEFAULT 0,
    favorites_removed INTEGER NOT NULL DEFAULT 0,
    searches INTEGER NOT NULL DEFAULT 0,
    search_successes INTEGER NOT NULL DEFAULT 0,
    search_no_results INTEGER NOT NULL DEFAULT 0,
    unique_users_count INTEGER NOT NULL DEFAULT 0,
    strategy_breakdown JSONB DEFAULT '{}'::jsonb,
    category_breakdown JSONB DEFAULT '{}'::jsonb,
    cuisine_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value, description, is_public)
VALUES 
    ('notifications', '{
        "welcomeEmailEnabled": true,
        "dailySuggestionsEnabled": true,
        "loginAlertsEnabled": true,
        "smtpVerificationRequired": true
    }'::jsonb, 'Global notification and email delivery controls', FALSE),
    ('ai_engine', '{
        "activeModel": "foodiebite-ai-v1",
        "provider": "local_deterministic",
        "rateLimitWindowMs": 60000,
        "rateLimitMax": 60
    }'::jsonb, 'Local AI nutritionist engine parameters', FALSE),
    ('client_app_config', '{
        "appVersion": "1.0.0",
        "maintenanceMode": false,
        "supportedLanguages": ["en", "es", "hi"],
        "supportEmail": "support@foodiebite.com"
    }'::jsonb, 'Public non-sensitive client application configuration', TRUE)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public;

CREATE TABLE IF NOT EXISTS public.ai_interaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    intent TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    latency_ms INTEGER DEFAULT 0,
    engine_provider TEXT NOT NULL DEFAULT 'local_deterministic',
    tokens_used INTEGER DEFAULT 0,
    response_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    message_id TEXT,
    campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    sender TEXT NOT NULL DEFAULT 'foodiebite881@gmail.com',
    provider TEXT NOT NULL DEFAULT 'smtp',
    resend_id TEXT,
    status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'sent', 'failed', 'queued')),
    response_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.segmentation_models (
    model_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'kmeans',
    cluster_count INTEGER NOT NULL DEFAULT 4,
    centroids JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'training', 'deprecated')),
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.segmentation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anonymous_user_id TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_cluster_assignment UNIQUE (anonymous_user_id, cluster_id)
);

CREATE TABLE IF NOT EXISTS public.foodiebite_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL,
    diet_tags TEXT[] NOT NULL DEFAULT '{}',
    goal_tags TEXT[] DEFAULT '{}',
    mood_tags TEXT[] DEFAULT '{}',
    weather_tags TEXT[] DEFAULT '{}',
    foods JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_foodiebite_recs_updated_at ON public.foodiebite_recommendations;
CREATE TRIGGER trigger_foodiebite_recs_updated_at
    BEFORE UPDATE ON public.foodiebite_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.api_health_pings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL DEFAULT 'api',
    status TEXT NOT NULL DEFAULT 'healthy',
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- PART 3: ROW LEVEL SECURITY & RE-RUN SAFE POLICIES (32 TABLES)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_deficiencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_recommendation_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmentation_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmentation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foodiebite_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_health_pings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_restricted" ON public.profiles;
CREATE POLICY "profiles_insert_own_restricted" ON public.profiles FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (
        auth.uid() = id
        AND role = 'user'
        AND disabled = FALSE
        AND account_status = 'active'
    )
);
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- Favorites Policies
DROP POLICY IF EXISTS "favorites_select_own" ON public.user_favorites;
CREATE POLICY "favorites_select_own" ON public.user_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "favorites_insert_own" ON public.user_favorites;
CREATE POLICY "favorites_insert_own" ON public.user_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "favorites_delete_own" ON public.user_favorites;
CREATE POLICY "favorites_delete_own" ON public.user_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Search History Policies
DROP POLICY IF EXISTS "search_history_select_own" ON public.user_search_history;
CREATE POLICY "search_history_select_own" ON public.user_search_history FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "search_history_insert_own" ON public.user_search_history;
CREATE POLICY "search_history_insert_own" ON public.user_search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "search_history_delete_own" ON public.user_search_history;
CREATE POLICY "search_history_delete_own" ON public.user_search_history FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Medical Reports Policies (Strict HIPAA/Private Health Isolation)
DROP POLICY IF EXISTS "medical_reports_select_own" ON public.medical_reports;
CREATE POLICY "medical_reports_select_own" ON public.medical_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "medical_reports_insert_own" ON public.medical_reports;
CREATE POLICY "medical_reports_insert_own" ON public.medical_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "medical_reports_update_own" ON public.medical_reports;
CREATE POLICY "medical_reports_update_own" ON public.medical_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "medical_reports_delete_own" ON public.medical_reports;
CREATE POLICY "medical_reports_delete_own" ON public.medical_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Health Profiles Policies
DROP POLICY IF EXISTS "health_profiles_select_own" ON public.health_profiles;
CREATE POLICY "health_profiles_select_own" ON public.health_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "health_profiles_update_own" ON public.health_profiles;
CREATE POLICY "health_profiles_update_own" ON public.health_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "health_profiles_insert_own" ON public.health_profiles;
CREATE POLICY "health_profiles_insert_own" ON public.health_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Deficiencies & Meal Logs Policies
DROP POLICY IF EXISTS "deficiencies_select_own" ON public.user_deficiencies;
CREATE POLICY "deficiencies_select_own" ON public.user_deficiencies FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "meal_logs_manage_own" ON public.user_meal_logs;
CREATE POLICY "meal_logs_manage_own" ON public.user_meal_logs FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "gamification_manage_own" ON public.user_gamification;
CREATE POLICY "gamification_manage_own" ON public.user_gamification FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Security & Activity Logs
DROP POLICY IF EXISTS "login_history_select_own" ON public.user_login_history;
CREATE POLICY "login_history_select_own" ON public.user_login_history FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "login_history_insert_own" ON public.user_login_history;
CREATE POLICY "login_history_insert_own" ON public.user_login_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activity_logs_select_own" ON public.user_activity_logs;
CREATE POLICY "activity_logs_select_own" ON public.user_activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.user_activity_logs;
CREATE POLICY "activity_logs_insert_authenticated" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- AI Coach Threads & Messages
DROP POLICY IF EXISTS "coach_threads_manage_own" ON public.coach_threads;
CREATE POLICY "coach_threads_manage_own" ON public.coach_threads FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "coach_messages_manage_own" ON public.coach_messages;
CREATE POLICY "coach_messages_manage_own" ON public.coach_messages FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Feedback Policies
DROP POLICY IF EXISTS "feedback_insert_authenticated" ON public.user_feedback;
CREATE POLICY "feedback_insert_authenticated" ON public.user_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "feedback_select_admin" ON public.user_feedback;
CREATE POLICY "feedback_select_admin" ON public.user_feedback FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "feedback_update_admin" ON public.user_feedback;
CREATE POLICY "feedback_update_admin" ON public.user_feedback FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "feedback_delete_admin" ON public.user_feedback;
CREATE POLICY "feedback_delete_admin" ON public.user_feedback FOR DELETE TO authenticated USING (public.is_admin());

-- Restaurant & Merchants
DROP POLICY IF EXISTS "restaurant_requests_owner_select" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_owner_select" ON public.restaurant_requests FOR SELECT TO authenticated USING (auth.uid() = owner_id OR public.is_admin());
DROP POLICY IF EXISTS "restaurant_requests_owner_insert" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_owner_insert" ON public.restaurant_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "restaurant_requests_admin_manage" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_admin_manage" ON public.restaurant_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "approved_restaurants_public_select" ON public.approved_restaurants;
CREATE POLICY "approved_restaurants_public_select" ON public.approved_restaurants FOR SELECT TO public USING (is_active = TRUE);
DROP POLICY IF EXISTS "approved_restaurants_admin_manage" ON public.approved_restaurants;
CREATE POLICY "approved_restaurants_admin_manage" ON public.approved_restaurants FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Cached Foods (Hardened: Read public, Insert/Update/Delete Admin Only; backend uses service-role)
DROP POLICY IF EXISTS "cached_foods_write_authenticated" ON public.cached_foods;
DROP POLICY IF EXISTS "cached_foods_public_select" ON public.cached_foods;
CREATE POLICY "cached_foods_public_select" ON public.cached_foods FOR SELECT TO public USING (TRUE);
DROP POLICY IF EXISTS "cached_foods_insert_authenticated" ON public.cached_foods;
DROP POLICY IF EXISTS "cached_foods_insert_admin" ON public.cached_foods;
CREATE POLICY "cached_foods_insert_admin" ON public.cached_foods FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "cached_foods_update_admin_only" ON public.cached_foods;
CREATE POLICY "cached_foods_update_admin_only" ON public.cached_foods FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "cached_foods_delete_admin_only" ON public.cached_foods;
CREATE POLICY "cached_foods_delete_admin_only" ON public.cached_foods FOR DELETE TO authenticated USING (public.is_admin());

-- Recommendations & Email Runs
DROP POLICY IF EXISTS "rec_runs_admin_only" ON public.daily_recommendation_runs;
CREATE POLICY "rec_runs_admin_only" ON public.daily_recommendation_runs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "rec_recipients_select_own_or_admin" ON public.daily_recommendation_recipients;
CREATE POLICY "rec_recipients_select_own_or_admin" ON public.daily_recommendation_recipients FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Admin-Only Operations
DROP POLICY IF EXISTS "campaigns_admin_only" ON public.email_campaigns;
CREATE POLICY "campaigns_admin_only" ON public.email_campaigns FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaign_recipients_admin_only" ON public.email_campaign_recipients;
CREATE POLICY "campaign_recipients_admin_only" ON public.email_campaign_recipients FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_audit_logs_select" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_audit_logs_insert" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "feature_aggregates_admin_select" ON public.feature_daily_aggregates;
CREATE POLICY "feature_aggregates_admin_select" ON public.feature_daily_aggregates FOR SELECT TO authenticated USING (public.is_admin());

-- System Settings (Hardened: Non-sensitive public config readable by clients, internal config admin-only)
DROP POLICY IF EXISTS "system_settings_read_authenticated" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
CREATE POLICY "system_settings_select_policy" ON public.system_settings FOR SELECT TO anon, authenticated USING (is_public = TRUE OR public.is_admin());
DROP POLICY IF EXISTS "system_settings_write_admin_only" ON public.system_settings;
CREATE POLICY "system_settings_write_admin_only" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Unsubscribes & Telemetry (Hardened: Direct public inserts removed)
DROP POLICY IF EXISTS "unsubscribes_public_insert" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "unsubscribes_insert_own" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_insert_own" ON public.email_unsubscribes FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'email') IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "unsubscribes_select_own_or_admin" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_select_own_or_admin" ON public.email_unsubscribes FOR SELECT TO authenticated USING (LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) OR public.is_admin());
DROP POLICY IF EXISTS "unsubscribes_admin_select" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "unsubscribes_admin_manage" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_admin_manage" ON public.email_unsubscribes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "analytics_events_insert_all" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert_authenticated" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_authenticated" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_select_admin" ON public.analytics_events FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "analytics_events_manage_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_manage_admin" ON public.analytics_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- AI Interaction Logs Policies
DROP POLICY IF EXISTS "ai_logs_select_own_or_admin" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_select_own_or_admin" ON public.ai_interaction_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "ai_logs_insert_authenticated" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_insert_authenticated" ON public.ai_interaction_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());
DROP POLICY IF EXISTS "ai_logs_admin_manage" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_admin_manage" ON public.ai_interaction_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Email Events & System Email Logs Policies (Hardened: Admin only; webhooks use service-role)
DROP POLICY IF EXISTS "email_events_webhook_insert" ON public.email_events;
DROP POLICY IF EXISTS "email_events_admin_select" ON public.email_events;
DROP POLICY IF EXISTS "email_events_admin_all" ON public.email_events;
CREATE POLICY "email_events_admin_all" ON public.email_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "system_email_logs_admin_all" ON public.system_email_logs;
CREATE POLICY "system_email_logs_admin_all" ON public.system_email_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- User Segmentation Models & Assignments
DROP POLICY IF EXISTS "segmentation_models_admin_all" ON public.segmentation_models;
CREATE POLICY "segmentation_models_admin_all" ON public.segmentation_models FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "segmentation_assignments_select_own_or_admin" ON public.segmentation_assignments;
CREATE POLICY "segmentation_assignments_select_own_or_admin" ON public.segmentation_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "segmentation_assignments_admin_manage" ON public.segmentation_assignments;
CREATE POLICY "segmentation_assignments_admin_manage" ON public.segmentation_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- FoodieBite Recommendations (Public Read Catalog)
DROP POLICY IF EXISTS "foodiebite_recs_public_select" ON public.foodiebite_recommendations;
CREATE POLICY "foodiebite_recs_public_select" ON public.foodiebite_recommendations FOR SELECT TO public USING (TRUE);
DROP POLICY IF EXISTS "foodiebite_recs_admin_manage" ON public.foodiebite_recommendations;
CREATE POLICY "foodiebite_recs_admin_manage" ON public.foodiebite_recommendations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- API Health Pings (Hardened: Admin only; health daemons use service-role)
DROP POLICY IF EXISTS "api_health_insert_all" ON public.api_health_pings;
DROP POLICY IF EXISTS "api_health_select_admin" ON public.api_health_pings;
DROP POLICY IF EXISTS "api_health_admin_all" ON public.api_health_pings;
CREATE POLICY "api_health_admin_all" ON public.api_health_pings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- PART 4: INDEXES & PERFORMANCE OPTIMIZATION
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON public.user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_user_id ON public.medical_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deficiencies_user_id ON public.user_deficiencies(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_id ON public.user_meal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.user_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_threads_user_id ON public.coach_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_user_id ON public.coach_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread_id ON public.coach_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_requests_owner_id ON public.restaurant_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_approved_restaurants_request_id ON public.approved_restaurants(request_id);
CREATE INDEX IF NOT EXISTS idx_rec_recipients_run_id ON public.daily_recommendation_recipients(run_id);
CREATE INDEX IF NOT EXISTS idx_rec_recipients_user_id ON public.daily_recommendation_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user_id ON public.email_campaign_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_user_id ON public.segmentation_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_disabled ON public.profiles(disabled) WHERE disabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.user_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_requests_status ON public.restaurant_requests(status);
CREATE INDEX IF NOT EXISTS idx_approved_restaurants_active ON public.approved_restaurants(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_approved_restaurants_geo ON public.approved_restaurants(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_cached_foods_barcode ON public.cached_foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cached_foods_expires ON public.cached_foods(expires_at);

CREATE INDEX IF NOT EXISTS idx_rec_runs_date ON public.daily_recommendation_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_rec_runs_status ON public.daily_recommendation_runs(status);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON public.analytics_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON public.admin_audit_logs(target_resource, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON public.system_settings(is_public);

CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_interaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_success ON public.ai_interaction_logs(success);
CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON public.email_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON public.email_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_system_email_logs_recipient ON public.system_email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_system_email_logs_status ON public.system_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_email_logs_created ON public.system_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_segmentation_anonymous ON public.segmentation_assignments(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_cluster ON public.segmentation_assignments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_api_health_pinged_at ON public.api_health_pings(pinged_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_messages_chronological ON public.coach_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_medical_reports_chronological ON public.medical_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_logs_chronological ON public.user_meal_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_chronological ON public.user_search_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gin_profiles_preferences ON public.profiles USING GIN (preferences);
CREATE INDEX IF NOT EXISTS gin_profiles_notifications ON public.profiles USING GIN (notification_settings);
CREATE INDEX IF NOT EXISTS gin_medical_reports_extracted ON public.medical_reports USING GIN (extracted_data);
CREATE INDEX IF NOT EXISTS gin_medical_reports_analysis ON public.medical_reports USING GIN (analysis);
CREATE INDEX IF NOT EXISTS gin_health_profiles_concerns ON public.health_profiles USING GIN (wellness_concerns);
CREATE INDEX IF NOT EXISTS gin_health_profiles_food ON public.health_profiles USING GIN (food_profile);
CREATE INDEX IF NOT EXISTS gin_favorites_food_data ON public.user_favorites USING GIN (food_data);
CREATE INDEX IF NOT EXISTS gin_analytics_metadata ON public.analytics_events USING GIN (metadata);
CREATE INDEX IF NOT EXISTS gin_cached_foods_nutriments ON public.cached_foods USING GIN (nutriments);
CREATE INDEX IF NOT EXISTS gin_foodiebite_recs_diet_tags ON public.foodiebite_recommendations USING GIN (diet_tags);
CREATE INDEX IF NOT EXISTS gin_foodiebite_recs_foods ON public.foodiebite_recommendations USING GIN (foods);

-- ------------------------------------------------------------------------------
-- STORAGE BUCKET & RLS POLICIES FOR MEDICAL REPORTS
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-reports',
    'medical-reports',
    false,
    20971520,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "medical_reports_storage_insert_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "medical_reports_storage_select_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "medical_reports_storage_update_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_update_own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "medical_reports_storage_delete_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );



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

-- ------------------------------------------------------------------------------
-- 6. SECURE ACCOUNT DELETION & RLS HARDENING (MIGRATION 20261119000009)
-- ------------------------------------------------------------------------------

-- Allow users to delete their own profile or admin to delete
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_delete_own_or_admin"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin());

-- User feedback RLS policies
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

-- Restaurant requests RLS policies
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

-- Atomic user account deletion function (Self-Service)
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

    -- A. Purge user files from storage.objects
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

-- Atomic admin user deletion function (Administrator Service)
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

