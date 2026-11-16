-- ==============================================================================
-- FOODIEBITE SUPABASE MIGRATION: 002_ROW_LEVEL_SECURITY.SQL (REMEDIATED)
-- Phase 1: Database Foundation
-- Target: PostgreSQL 15+ (Supabase)
-- 
-- Summary of Remediations Applied:
--   - Added 'DROP POLICY IF EXISTS' before every single policy declaration (100% re-run safe).
--   - Hardened 'cached_foods' RLS: restricted UPDATE and DELETE strictly to admin.
--   - Enforced strict tenant boundaries: users cannot access other users' data.
--   - Implemented granular RLS policies for all newly added collection tables:
--     ai_interaction_logs, email_events, system_email_logs, segmentation_models,
--     segmentation_assignments, foodiebite_recommendations, and api_health_pings.
--   - Preserved HIPAA-grade private medical report isolation (auth.uid() = user_id).
-- ==============================================================================

-- 1. ENABLE ROW LEVEL SECURITY ON ALL 32 TABLES
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

-- ------------------------------------------------------------------------------
-- 2. PROFILES POLICIES
-- Users can view and update their own profile information.
-- Admin can view and manage all profiles.
-- Privilege escalation (modifying role/disabled) is blocked by trg_prevent_privilege_escalation.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_restricted" ON public.profiles;
CREATE POLICY "profiles_insert_own_restricted"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR (
            auth.uid() = id
            AND role = 'user'
            AND disabled = FALSE
            AND account_status = 'active'
        )
    );

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. USER FAVORITES POLICIES
-- Strict user-level isolation for meal and food favorites.
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
-- 4. USER SEARCH HISTORY POLICIES
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
-- 5. MEDICAL REPORTS POLICIES (HIPAA / HEALTH INFORMATION PRIVACY)
-- Strictly accessible ONLY to the individual owner. Even general admin browsing
-- is restricted to protect sensitive medical telemetry.
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
-- 6. HEALTH PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "health_profiles_select_own" ON public.health_profiles;
CREATE POLICY "health_profiles_select_own"
    ON public.health_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "health_profiles_update_own" ON public.health_profiles;
CREATE POLICY "health_profiles_update_own"
    ON public.health_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "health_profiles_insert_own" ON public.health_profiles;
CREATE POLICY "health_profiles_insert_own"
    ON public.health_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. USER DEFICIENCIES, MEAL LOGS & GAMIFICATION
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "deficiencies_select_own" ON public.user_deficiencies;
CREATE POLICY "deficiencies_select_own"
    ON public.user_deficiencies FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "meal_logs_manage_own" ON public.user_meal_logs;
CREATE POLICY "meal_logs_manage_own"
    ON public.user_meal_logs FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "gamification_manage_own" ON public.user_gamification;
CREATE POLICY "gamification_manage_own"
    ON public.user_gamification FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. LOGIN & ACTIVITY LOGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "login_history_select_own" ON public.user_login_history;
CREATE POLICY "login_history_select_own"
    ON public.user_login_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "login_history_insert_own" ON public.user_login_history;
CREATE POLICY "login_history_insert_own"
    ON public.user_login_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity_logs_select_own" ON public.user_activity_logs;
CREATE POLICY "activity_logs_select_own"
    ON public.user_activity_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.user_activity_logs;
CREATE POLICY "activity_logs_insert_authenticated"
    ON public.user_activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ------------------------------------------------------------------------------
-- 9. AI COACH THREADS & MESSAGES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "coach_threads_manage_own" ON public.coach_threads;
CREATE POLICY "coach_threads_manage_own"
    ON public.coach_threads FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "coach_messages_manage_own" ON public.coach_messages;
CREATE POLICY "coach_messages_manage_own"
    ON public.coach_messages FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 10. USER FEEDBACK POLICIES
-- Authenticated users can insert feedback; only designated admin can view and resolve.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "feedback_insert_authenticated" ON public.user_feedback;
CREATE POLICY "feedback_insert_authenticated"
    ON public.user_feedback FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "feedback_select_admin" ON public.user_feedback;
CREATE POLICY "feedback_select_admin"
    ON public.user_feedback FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "feedback_update_admin" ON public.user_feedback;
CREATE POLICY "feedback_update_admin"
    ON public.user_feedback FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "feedback_delete_admin" ON public.user_feedback;
CREATE POLICY "feedback_delete_admin"
    ON public.user_feedback FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 11. RESTAURANTS & MERCHANTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "restaurant_requests_owner_select" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_owner_select"
    ON public.restaurant_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "restaurant_requests_owner_insert" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_owner_insert"
    ON public.restaurant_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "restaurant_requests_admin_manage" ON public.restaurant_requests;
CREATE POLICY "restaurant_requests_admin_manage"
    ON public.restaurant_requests FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "approved_restaurants_public_select" ON public.approved_restaurants;
CREATE POLICY "approved_restaurants_public_select"
    ON public.approved_restaurants FOR SELECT
    TO public
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "approved_restaurants_admin_manage" ON public.approved_restaurants;
CREATE POLICY "approved_restaurants_admin_manage"
    ON public.approved_restaurants FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. CACHED FOODS (HARDENED SECURITY)
-- Public read access for browsing nutrition catalog.
-- Direct client INSERT is removed to prevent cache poisoning; backend uses service-role.
-- INSERT, UPDATE and DELETE are strictly restricted to the designated administrator.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cached_foods_write_authenticated" ON public.cached_foods;
DROP POLICY IF EXISTS "cached_foods_public_select" ON public.cached_foods;
CREATE POLICY "cached_foods_public_select"
    ON public.cached_foods FOR SELECT
    TO public
    USING (TRUE);

DROP POLICY IF EXISTS "cached_foods_insert_authenticated" ON public.cached_foods;
DROP POLICY IF EXISTS "cached_foods_insert_admin" ON public.cached_foods;
CREATE POLICY "cached_foods_insert_admin"
    ON public.cached_foods FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cached_foods_update_admin_only" ON public.cached_foods;
CREATE POLICY "cached_foods_update_admin_only"
    ON public.cached_foods FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cached_foods_delete_admin_only" ON public.cached_foods;
CREATE POLICY "cached_foods_delete_admin_only"
    ON public.cached_foods FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 13. RECOMMENDATIONS & EMAIL RUNS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "rec_runs_admin_only" ON public.daily_recommendation_runs;
CREATE POLICY "rec_runs_admin_only"
    ON public.daily_recommendation_runs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rec_recipients_select_own_or_admin" ON public.daily_recommendation_recipients;
CREATE POLICY "rec_recipients_select_own_or_admin"
    ON public.daily_recommendation_recipients FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 14. EMAIL CAMPAIGNS & AUDIT LOGS (ADMIN ONLY)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "campaigns_admin_only" ON public.email_campaigns;
CREATE POLICY "campaigns_admin_only"
    ON public.email_campaigns FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "campaign_recipients_admin_only" ON public.email_campaign_recipients;
CREATE POLICY "campaign_recipients_admin_only"
    ON public.email_campaign_recipients FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_logs_select" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_logs_insert" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert"
    ON public.admin_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "feature_aggregates_admin_select" ON public.feature_daily_aggregates;
CREATE POLICY "feature_aggregates_admin_select"
    ON public.feature_daily_aggregates FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 15. SYSTEM SETTINGS POLICIES (HARDENED)
-- Non-sensitive public client configurations (is_public = TRUE) are readable by clients.
-- Internal settings (is_public = FALSE) are strictly restricted to the administrator.
-- Secrets (API keys, SMTP passwords, service-role keys) are NEVER stored in this table.
-- Modification is strictly restricted to the designated administrator.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "system_settings_read_authenticated" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
CREATE POLICY "system_settings_select_policy"
    ON public.system_settings FOR SELECT
    TO anon, authenticated
    USING (is_public = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "system_settings_write_admin_only" ON public.system_settings;
CREATE POLICY "system_settings_write_admin_only"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 16. EMAIL UNSUBSCRIBES (Protected Opt-Out Handling)
-- Direct unauthenticated public insert removed to prevent mass unsubscribe spoofing.
-- Authenticated users can insert or view their own unsubscribe record.
-- Unauthenticated HMAC one-click unsubscribe links are processed by the backend via service-role.
-- Designated administrator has full management access.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "unsubscribes_public_insert" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "unsubscribes_insert_own" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_insert_own"
    ON public.email_unsubscribes FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'email') IS NOT NULL
        AND LOWER(email) = LOWER(auth.jwt() ->> 'email')
    );

DROP POLICY IF EXISTS "unsubscribes_select_own_or_admin" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_select_own_or_admin"
    ON public.email_unsubscribes FOR SELECT
    TO authenticated
    USING (
        LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "unsubscribes_admin_select" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "unsubscribes_admin_manage" ON public.email_unsubscribes;
CREATE POLICY "unsubscribes_admin_manage"
    ON public.email_unsubscribes FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 17. ANALYTICS EVENTS (Telemetry Ingestion - Hardened)
-- Direct unauthenticated public insertion removed to prevent analytics poisoning.
-- Authenticated users can record only events matching their own authenticated user_id.
-- High-throughput aggregated backend ingestion uses the service-role key.
-- Admin can view and manage all events.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "analytics_events_insert_all" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert_authenticated" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_authenticated"
    ON public.analytics_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_select_admin"
    ON public.analytics_events FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "analytics_events_manage_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_manage_admin"
    ON public.analytics_events FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 18. AI INTERACTION LOGS POLICIES (NEW)
-- Users can see their own AI query history; admin can inspect all logs.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_logs_select_own_or_admin" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_select_own_or_admin"
    ON public.ai_interaction_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "ai_logs_insert_authenticated" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_insert_authenticated"
    ON public.ai_interaction_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "ai_logs_admin_manage" ON public.ai_interaction_logs;
CREATE POLICY "ai_logs_admin_manage"
    ON public.ai_interaction_logs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 19. EMAIL EVENTS & SYSTEM EMAIL LOGS POLICIES (HARDENED)
-- Direct unauthenticated public webhook insert removed to prevent event forgery.
-- Verified Brevo webhooks are accepted and processed by backend/edge workers via service-role.
-- Direct table access is restricted strictly to the designated administrator.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_events_webhook_insert" ON public.email_events;
DROP POLICY IF EXISTS "email_events_admin_select" ON public.email_events;
DROP POLICY IF EXISTS "email_events_admin_all" ON public.email_events;
CREATE POLICY "email_events_admin_all"
    ON public.email_events FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "system_email_logs_admin_all" ON public.system_email_logs;
CREATE POLICY "system_email_logs_admin_all"
    ON public.system_email_logs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 20. USER SEGMENTATION MODELS & ASSIGNMENTS (NEW)
-- Admin-only machine learning clustering models; users read own persona.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "segmentation_models_admin_all" ON public.segmentation_models;
CREATE POLICY "segmentation_models_admin_all"
    ON public.segmentation_models FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "segmentation_assignments_select_own_or_admin" ON public.segmentation_assignments;
CREATE POLICY "segmentation_assignments_select_own_or_admin"
    ON public.segmentation_assignments FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "segmentation_assignments_admin_manage" ON public.segmentation_assignments;
CREATE POLICY "segmentation_assignments_admin_manage"
    ON public.segmentation_assignments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 21. FOODIEBITE RECOMMENDATIONS (NEW)
-- Publicly readable food recommendation catalog; admin managed.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "foodiebite_recs_public_select" ON public.foodiebite_recommendations;
CREATE POLICY "foodiebite_recs_public_select"
    ON public.foodiebite_recommendations FOR SELECT
    TO public
    USING (TRUE);

DROP POLICY IF EXISTS "foodiebite_recs_admin_manage" ON public.foodiebite_recommendations;
CREATE POLICY "foodiebite_recs_admin_manage"
    ON public.foodiebite_recommendations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 22. API HEALTH PINGS (HARDENED)
-- Direct unauthenticated insert removed to prevent heartbeat forgery and DOS.
-- Uptime monitors and internal health probes insert using service-role.
-- Table viewing and management is restricted strictly to the designated administrator.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "api_health_insert_all" ON public.api_health_pings;
DROP POLICY IF EXISTS "api_health_select_admin" ON public.api_health_pings;
DROP POLICY IF EXISTS "api_health_admin_all" ON public.api_health_pings;
CREATE POLICY "api_health_admin_all"
    ON public.api_health_pings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
