-- ==============================================================================
-- FOODIEBITE SUPABASE MIGRATION: 001_CORE_SCHEMA.SQL (HARDENED)
-- Phase 1: Database Foundation
-- Target: PostgreSQL 15+ (Supabase)
-- 
-- Summary of Remediations Applied:
--   - Strict single-admin authorization: is_admin() strictly checks designated
--     email sham111205s@gmail.com, verifies active & non-disabled profile state,
--     and rejects any client or JWT metadata role claims.
--   - Implemented 'prevent_profile_privilege_escalation()' trigger preventing
--     unauthorized modification of role, disabled, and account_status fields.
--   - Hardened 'handle_new_user()' trigger: client metadata role is strictly ignored.
--   - Added 'firebase_uid TEXT UNIQUE' to public.profiles to preserve legacy mapping.
--   - Nullable emails are safely handled using a deterministic unique placeholder.
--   - Added all 6 missing collection tables: ai_interaction_logs, email_events,
--     system_email_logs, segmentation_models, segmentation_assignments,
--     foodiebite_recommendations, and api_health_pings (100% Firestore coverage).
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. AUTOMATIC TIMESTAMP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. DESIGNATED ADMINISTRATOR AUTHORIZATION FUNCTION
-- Strictly verifies that the authenticated requester is the single designated administrator:
-- 'sham111205s@gmail.com'.
-- Requirements:
--   1. Rejects any admin claims based on client-controllable or JWT metadata.
--   2. Verifies the authenticated caller's JWT email is strictly 'sham111205s@gmail.com'.
--   3. Verifies that public.profiles has role = 'admin', disabled = FALSE, and account_status = 'active'.
--   4. Suspended, disabled, or non-matching accounts immediately evaluate to FALSE.
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

-- 4. PROFILE PRIVILEGE ESCALATION PREVENTION TRIGGER
-- Prevents standard users from modifying their role, disabled status, or account_status.
-- Only the active, non-disabled designated administrator can alter these sensitive administrative fields.
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

-- 5. SANITIZED NEW USER PROVISIONING TRIGGER FUNCTION
-- Safely provisions public.profiles from auth.users on signup.
-- Strictly sets role = 'admin' ONLY for sham111205s@gmail.com.
-- All other accounts receive role = 'user'. Client metadata role is strictly ignored.
-- Safely handles nullable emails without collisions.
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
        -- Unique deterministic placeholder per UUID
        v_clean_email := 'user_' || REPLACE(NEW.id::text, '-', '') || '@placeholder.supabase.co';
    END IF;

    -- Strict authorization rule
    IF v_clean_email = 'sham111205s@gmail.com' THEN
        v_role := 'admin';
    ELSE
        v_role := 'user'; -- Client metadata role is strictly ignored
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
        NULL, -- Populated during historical Firebase data migration
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
-- TABLE 1: profiles (Master User Directory)
-- Replaces: Firestore /users/{userId} master document & backend users_directory.json
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    firebase_uid TEXT UNIQUE, -- Historical Firebase string UID correlation
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

-- Triggers on public.profiles
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

-- Trigger hooking auth.users signup to public.profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- TABLE 2: user_favorites (Favorite Foods & Dishes)
-- Replaces: Firestore /users/{userId}.favoriteFoods array & /api/user/favorites
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 3: user_search_history (Search Queries & Filter Audit)
-- Replaces: Firestore /users/{userId}.searchHistory array
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    result_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABLE 4: medical_reports (Clinical Lab Reports & OCR Metadata)
-- Replaces: Firestore /medicalReports/{reportId} & /users/{userId}/medicalReports
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 5: health_profiles (Consolidated Biomarker Health Profile)
-- Replaces: backend/data/health_profiles_db.json & User Health Aggregates
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 6: user_deficiencies (Detected Nutritional Deficiencies)
-- Replaces: Firestore /users/{userId}/deficiencies/{defId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 7: user_meal_logs (Nutritional Meal Intake Diary)
-- Replaces: Firestore /users/{userId}/mealLogs/{logId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 8: user_gamification (Habit Streaks & Wellness Badges)
-- Replaces: Firestore /users/{userId}/gamification/{docId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 9: user_login_history (Security & Device Audit Trail)
-- Replaces: Firestore /users/{userId}/loginHistory/{id}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 10: user_activity_logs (User Actions & Event Log)
-- Replaces: Firestore /users/{userId}/activityLogs/{id}
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABLE 11: coach_threads (AI Dietitian Chat Sessions)
-- Replaces: Firestore /users/{userId}/threads/{threadId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 12: coach_messages (AI Dietitian Messages)
-- Replaces: Firestore /users/{userId}/threads/{tId}/messages/{msgId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 13: user_feedback (Support & Feedback Submissions)
-- Replaces: Firestore /feedback/{feedbackId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 14: restaurant_requests (Merchant Onboarding Applications)
-- Replaces: Firestore /restaurantRequests/{reqId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 15: approved_restaurants (Verified Public Restaurant Catalog)
-- Replaces: Firestore /approvedRestaurants/{restId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 16: cached_foods (Open Food Facts & Global Food Item Cache)
-- Replaces: Firestore /cachedFoods/{foodId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 17: daily_recommendation_runs (Scheduler Email Batches)
-- Replaces: Firestore /dailyRecommendationRuns/{runId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 18: daily_recommendation_recipients (Per-User Recommendation Log)
-- Replaces: Firestore /dailyRecommendationRecipients/{recipId} & /users/{uid}/emailHistory
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 19: email_campaigns (Broadcast & Lifecycle Email Campaigns)
-- Replaces: Firestore /emailCampaigns/{campaignId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 20: email_campaign_recipients (Per-User Campaign Delivery Progress)
-- Replaces: Firestore /emailCampaignRecipients/{recipId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 21: email_unsubscribes (CAN-SPAM / GDPR Suppressed Email Registry)
-- Replaces: Firestore /email_unsubscribes/{email}
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
    email TEXT PRIMARY KEY,
    reason TEXT DEFAULT 'user_opt_out',
    unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABLE 22: analytics_events (User Behavior & Telemetry Events)
-- Replaces: Firestore /analyticsEvents/{eventId} & analytics_events.json
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 23: feature_daily_aggregates (Daily Roll-up Metrics)
-- Replaces: Firestore /feature_aggregates/{date} & analytics_daily.json
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 24: admin_audit_logs (Immutable Administrator Action Ledger)
-- Replaces: Firestore /admin_audit_logs/{logId}
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 25: system_settings (Application-Wide Configuration)
-- Replaces: Firestore /system/{configId} & notification_settings.json
-- Security Note: Secrets (API keys, SMTP passwords, service-role keys) are NEVER
-- stored here; they are managed strictly via environment variables.
-- Column 'is_public' separates non-sensitive public config from internal admin config.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default System Settings
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

-- ------------------------------------------------------------------------------
-- TABLE 26: ai_interaction_logs (AI Dietitian Query & Latency Telemetry)
-- Replaces: Firestore /ai_logs/{logId} (backend/src/controllers/adminController.js:1063)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 27: email_events (Inbound Webhook Delivery & Engagement Events)
-- Replaces: Firestore /email_events/{eventId} (backend/src/services/brevoService.js:1455)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 28: system_email_logs (SMTP / Transactional Email Dispatch Audit)
-- Replaces: Firestore /email_logs/{logId} (backend/src/services/mailService.js:138)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 29: segmentation_models (ML User Clustering & Personas)
-- Replaces: Firestore /segmentationModels/{modelId} & segmentation_models.json
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 30: segmentation_assignments (Per-User Segmentation Assignments)
-- Replaces: backend/data/segmentation_assignments.json
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.segmentation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anonymous_user_id TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_cluster_assignment UNIQUE (anonymous_user_id, cluster_id)
);

-- ------------------------------------------------------------------------------
-- TABLE 31: foodiebite_recommendations (Precomputed Recommendation Catalog)
-- Replaces: Firestore /foodiebiteRecommendations/{recId} (recommendationDbService.js:213)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- TABLE 32: api_health_pings (Heartbeat Keepalive Ping History)
-- Replaces: Firestore /apiHealth/{pingId} (backend/src/server.js:156)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_health_pings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL DEFAULT 'api',
    status TEXT NOT NULL DEFAULT 'healthy',
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
