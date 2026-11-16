-- ==============================================================================
-- FOODIEBITE SUPABASE MIGRATION: 003_INDEXES_AND_PERFORMANCE.SQL (REMEDIATED)
-- Phase 1: Database Foundation
-- Target: PostgreSQL 15+ (Supabase)
-- 
-- Summary of Remediations Applied:
--   - Added index on profiles.firebase_uid for fast historical ETL lookups.
--   - Added indexing for all 6 new tables: ai_interaction_logs, email_events,
--     system_email_logs, segmentation_assignments, foodiebite_recommendations,
--     and api_health_pings.
--   - Added GIN array index on foodiebite_recommendations.diet_tags.
--   - Fully idempotent: every statement uses IF NOT EXISTS.
-- ==============================================================================

-- 1. FOREIGN KEY RELATIONSHIP INDEXES
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

-- New Table Foreign Keys
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_user_id ON public.segmentation_assignments(user_id);

-- 2. HIGH-FREQUENCY B-TREE QUERY INDEXES
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

-- New Table Indexes
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

-- 3. COMPOUND CHRONOLOGICAL FEED INDEXES
CREATE INDEX IF NOT EXISTS idx_coach_messages_chronological ON public.coach_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_medical_reports_chronological ON public.medical_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_logs_chronological ON public.user_meal_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_chronological ON public.user_search_history(user_id, created_at DESC);

-- 4. POSTGRESQL GIN INDEXES ON JSONB DOCUMENTS & ARRAYS
CREATE INDEX IF NOT EXISTS gin_profiles_preferences ON public.profiles USING GIN (preferences);
CREATE INDEX IF NOT EXISTS gin_profiles_notifications ON public.profiles USING GIN (notification_settings);
CREATE INDEX IF NOT EXISTS gin_medical_reports_extracted ON public.medical_reports USING GIN (extracted_data);
CREATE INDEX IF NOT EXISTS gin_medical_reports_analysis ON public.medical_reports USING GIN (analysis);
CREATE INDEX IF NOT EXISTS gin_health_profiles_concerns ON public.health_profiles USING GIN (wellness_concerns);
CREATE INDEX IF NOT EXISTS gin_health_profiles_food ON public.health_profiles USING GIN (food_profile);
CREATE INDEX IF NOT EXISTS gin_favorites_food_data ON public.user_favorites USING GIN (food_data);
CREATE INDEX IF NOT EXISTS gin_analytics_metadata ON public.analytics_events USING GIN (metadata);
CREATE INDEX IF NOT EXISTS gin_cached_foods_nutriments ON public.cached_foods USING GIN (nutriments);

-- Array GIN Index on Recommendation Tags
CREATE INDEX IF NOT EXISTS gin_foodiebite_recs_diet_tags ON public.foodiebite_recommendations USING GIN (diet_tags);
CREATE INDEX IF NOT EXISTS gin_foodiebite_recs_foods ON public.foodiebite_recommendations USING GIN (foods);
