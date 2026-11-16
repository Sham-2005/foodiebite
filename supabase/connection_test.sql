-- ==============================================================================
-- FOODIEBITE SUPABASE: CONNECTION TEST TABLE & RLS POLICY
-- Target: PostgreSQL 15+ (Supabase SQL Editor)
-- Purpose: Temporary table used exclusively for verifying frontend-to-Supabase
--          connectivity without exposing application data or modifying existing tables.
-- ==============================================================================

-- 1. Create temporary test table (if not exists)
CREATE TABLE IF NOT EXISTS public.connection_test (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL DEFAULT 'FoodieBite Supabase connection successful',
    tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert test verification row (idempotent upsert)
INSERT INTO public.connection_test (id, message, tested_at)
VALUES (
    1,
    'FoodieBite Supabase connection successful',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET 
    tested_at = NOW(),
    message = EXCLUDED.message;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.connection_test ENABLE ROW LEVEL SECURITY;

-- 4. Safe Read-Only Policy for Anon & Authenticated Clients
-- Allows SELECT queries only so the frontend connection health check can read the status.
DROP POLICY IF EXISTS "connection_test_read_public" ON public.connection_test;
CREATE POLICY "connection_test_read_public"
    ON public.connection_test FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- 5. Strict Denial of Public Write Operations
-- No INSERT, UPDATE, or DELETE policies exist for anon or standard authenticated users.
-- Direct modifications are restricted strictly to the designated administrator or service-role.
DROP POLICY IF EXISTS "connection_test_admin_manage" ON public.connection_test;
CREATE POLICY "connection_test_admin_manage"
    ON public.connection_test FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Verification query to confirm successful setup
SELECT 
    id, 
    message, 
    tested_at 
FROM public.connection_test 
LIMIT 5;
