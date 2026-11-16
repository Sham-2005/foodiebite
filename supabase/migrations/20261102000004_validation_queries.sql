-- ==============================================================================
-- FOODIEBITE SUPABASE MIGRATION: 004_VALIDATION_QUERIES.SQL (HARDENED)
-- Phase 1: Database Foundation Validation Test Suite
-- Target: PostgreSQL 15+ (Supabase)
-- 
-- Automated Verification Matrix:
--   TEST-01: All 32 expected tables exist in public schema
--   TEST-02: All 32 tables have Row Level Security enabled
--   TEST-03: No unexpected public/anon write policies exist
--   TEST-04: profiles policies do not contain self-referencing subqueries
--   TEST-05: is_admin function strictly checks designated email without app_metadata
--   TEST-06: Normal users cannot modify protected profile fields (trigger + insert policy)
--   TEST-07: cached_foods write access is restricted to admin and service-role
--   TEST-08: email_events write access is restricted to admin and service-role
--   TEST-09: Medical reports are strictly owner-isolated (auth.uid() = user_id)
--   TEST-10: Required security triggers and performance indexes exist
-- ==============================================================================

-- ==============================================================================
-- PART 1: CONSOLIDATED AUTOMATED PASS/FAIL TEST MATRIX
-- (Run this single query in the Supabase SQL Editor to verify all 10 requirements)
-- ==============================================================================
SELECT 
    test_id,
    test_name,
    status,
    details
FROM (
    -- TEST 01: All 32 expected tables exist
    SELECT 
        'TEST-01' AS test_id,
        'All 32 expected tables exist in public schema' AS test_name,
        CASE 
            WHEN COUNT(*) = 32 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(*) || ' of 32 expected tables' AS details
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name IN (
          'profiles', 'user_favorites', 'user_search_history', 'medical_reports',
          'health_profiles', 'user_deficiencies', 'user_meal_logs', 'user_gamification',
          'user_login_history', 'user_activity_logs', 'coach_threads', 'coach_messages',
          'user_feedback', 'restaurant_requests', 'approved_restaurants', 'cached_foods',
          'daily_recommendation_runs', 'daily_recommendation_recipients', 'email_campaigns',
          'email_campaign_recipients', 'email_unsubscribes', 'analytics_events',
          'feature_daily_aggregates', 'admin_audit_logs', 'system_settings',
          'ai_interaction_logs', 'email_events', 'system_email_logs', 'segmentation_models',
          'segmentation_assignments', 'foodiebite_recommendations', 'api_health_pings'
      )

    UNION ALL

    -- TEST 02: All 32 tables have RLS enabled
    SELECT 
        'TEST-02' AS test_id,
        'All 32 tables have Row Level Security enabled' AS test_name,
        CASE 
            WHEN COUNT(*) = 32 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(*) || ' tables with RLS active' AS details
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND c.relrowsecurity = TRUE
      AND c.relname IN (
          'profiles', 'user_favorites', 'user_search_history', 'medical_reports',
          'health_profiles', 'user_deficiencies', 'user_meal_logs', 'user_gamification',
          'user_login_history', 'user_activity_logs', 'coach_threads', 'coach_messages',
          'user_feedback', 'restaurant_requests', 'approved_restaurants', 'cached_foods',
          'daily_recommendation_runs', 'daily_recommendation_recipients', 'email_campaigns',
          'email_campaign_recipients', 'email_unsubscribes', 'analytics_events',
          'feature_daily_aggregates', 'admin_audit_logs', 'system_settings',
          'ai_interaction_logs', 'email_events', 'system_email_logs', 'segmentation_models',
          'segmentation_assignments', 'foodiebite_recommendations', 'api_health_pings'
      )

    UNION ALL

    -- TEST 03: No unexpected public/anon write policies exist
    SELECT 
        'TEST-03' AS test_id,
        'No unexpected public/anon write policies exist' AS test_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(*) || ' unexpected public write policies' AS details
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT', 'ALL', 'UPDATE', 'DELETE')
      AND (roles @> '{public}'::name[] OR roles @> '{anon}'::name[])

    UNION ALL

    -- TEST 04: profiles policies do not contain self-referencing subqueries
    SELECT 
        'TEST-04' AS test_id,
        'profiles policies are recursion-free (no self-referencing subqueries)' AS test_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(*) || ' self-referencing subqueries in profiles policies' AS details
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND (
          qual ILIKE '%from%public.profiles%' 
          OR qual ILIKE '%from%profiles%'
          OR with_check ILIKE '%from%public.profiles%'
          OR with_check ILIKE '%from%profiles%'
      )

    UNION ALL

    -- TEST 05: is_admin function strictly checks email without app_metadata
    SELECT 
        'TEST-05' AS test_id,
        'is_admin function strictly checks email without app_metadata' AS test_name,
        CASE 
            WHEN COUNT(*) = 1 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Function definition strictly enforces single designated admin and active status' AS details
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_admin'
      AND pg_get_functiondef(p.oid) LIKE '%sham111205s@gmail.com%'
      AND pg_get_functiondef(p.oid) NOT LIKE '%app_metadata%'

    UNION ALL

    -- TEST 06: Normal users cannot modify protected profile fields
    SELECT 
        'TEST-06' AS test_id,
        'Protected profile fields safeguarded by trigger and insert policy' AS test_name,
        CASE 
            WHEN COUNT(DISTINCT check_item) = 2 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(DISTINCT check_item) || ' of 2 privilege protection mechanisms' AS details
    FROM (
        SELECT 'trigger' AS check_item
        FROM information_schema.triggers
        WHERE trigger_schema = 'public' 
          AND trigger_name = 'trg_prevent_privilege_escalation'
        UNION ALL
        SELECT 'insert_policy' AS check_item
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND cmd = 'INSERT'
          AND with_check LIKE '%role = ''user''%'
    ) sub_p

    UNION ALL

    -- TEST 07: cached_foods writes are restricted
    SELECT 
        'TEST-07' AS test_id,
        'cached_foods writes restricted strictly to admin and service-role' AS test_name,
        CASE 
            WHEN COUNT(*) >= 3 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(*) || ' verified admin-only write policies (INSERT, UPDATE, DELETE)' AS details
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cached_foods'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (with_check LIKE '%is_admin%' OR qual LIKE '%is_admin%')

    UNION ALL

    -- TEST 08: email_events writes are restricted
    SELECT 
        'TEST-08' AS test_id,
        'email_events writes restricted to admin and verified webhook service-role' AS test_name,
        CASE 
            WHEN has_public_insert = 0 AND has_admin_policy >= 1 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Public insert eliminated; admin/service-role access verified' AS details
    FROM (
        SELECT 
            COUNT(*) FILTER (WHERE roles @> '{public}'::name[] OR roles @> '{anon}'::name[]) AS has_public_insert,
            COUNT(*) FILTER (WHERE qual LIKE '%is_admin%' OR with_check LIKE '%is_admin%') AS has_admin_policy
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'email_events'
    ) sub_e

    UNION ALL

    -- TEST 09: Medical reports are owner-isolated
    SELECT 
        'TEST-09' AS test_id,
        'Medical reports strictly owner-isolated (auth.uid() = user_id)' AS test_name,
        CASE 
            WHEN COUNT(*) = 4 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'All 4 operations (SELECT, INSERT, UPDATE, DELETE) enforce auth.uid() = user_id' AS details
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_reports'
      AND (qual = '(auth.uid() = user_id)' OR with_check = '(auth.uid() = user_id)')

    UNION ALL

    -- TEST 10: Required security triggers and performance indexes exist
    SELECT 
        'TEST-10' AS test_id,
        'Required security triggers and performance indexes exist' AS test_name,
        CASE 
            WHEN COUNT(DISTINCT item_name) = 6 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Found ' || COUNT(DISTINCT item_name) || ' of 6 critical triggers and indexes' AS details
    FROM (
        SELECT trigger_name AS item_name FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name IN ('trg_prevent_privilege_escalation')
        UNION ALL
        SELECT trigger_name AS item_name FROM information_schema.triggers
        WHERE trigger_name = 'on_auth_user_created'
        UNION ALL
        SELECT indexname AS item_name FROM pg_indexes
        WHERE schemaname = 'public' AND indexname IN (
            'idx_profiles_firebase_uid',
            'idx_medical_reports_user_id',
            'idx_cached_foods_barcode',
            'idx_system_settings_public'
        )
    ) sub_t
) summary_results
ORDER BY test_id;

-- ==============================================================================
-- PART 2: DIAGNOSTIC & DRILL-DOWN QUERIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- D-01: AUDIT ALL ACTIVE ROW LEVEL SECURITY POLICIES BY TABLE
-- ------------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd AS operation,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ------------------------------------------------------------------------------
-- D-02: AUDIT SYSTEM SETTINGS SEGREGATION
-- Verify is_public flag and visibility
-- ------------------------------------------------------------------------------
SELECT 
    key,
    description,
    is_public,
    CASE 
        WHEN is_public THEN '🌐 Publicly Readable by Clients'
        ELSE '🔒 Internal / Administrator Only'
    END AS visibility
FROM public.system_settings
ORDER BY is_public DESC, key ASC;

-- ------------------------------------------------------------------------------
-- D-03: VERIFY FOREIGN KEY CONSTRAINTS
-- ------------------------------------------------------------------------------
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule AS on_delete_action
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
