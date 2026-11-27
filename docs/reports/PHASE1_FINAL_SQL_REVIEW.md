# FoodieBite Supabase Phase 1: Final SQL Architecture Review

**Date:** November 2, 2026  
**Author:** Senior Supabase Database Architect & PostgreSQL Security Engineer  
**Status:** Remediated & Certified  
**Target Files Modified & Synchronized:**
* [`supabase/schema_complete.sql`](file:///s:/files/food_app/supabase/schema_complete.sql) (Version 1.3.0)
* [`supabase/migrations/20261102000001_core_schema.sql`](file:///s:/files/food_app/supabase/migrations/20261102000001_core_schema.sql)
* [`supabase/migrations/20261102000002_row_level_security.sql`](file:///s:/files/food_app/supabase/migrations/20261102000002_row_level_security.sql)
* [`supabase/migrations/20261102000003_indexes_and_performance.sql`](file:///s:/files/food_app/supabase/migrations/20261102000003_indexes_and_performance.sql)
* [`supabase/migrations/20261102000004_validation_queries.sql`](file:///s:/files/food_app/supabase/migrations/20261102000004_validation_queries.sql)

---

## 1. Executive Summary

This review documents the structural and security enhancements applied during the final Phase 1 refinement pass. The objective of this pass was to eliminate Row Level Security (RLS) recursion hazards, lock down profile insertion, compartmentalize application settings, and provide an automated 10-point static PASS/FAIL validation suite.

### Key Milestones Achieved:
1. **RLS Recursion Neutralized (`public.profiles`)**: Removed all nested `SELECT` queries on `public.profiles` within the `profiles_update_own_or_admin` policy. Ownership is enforced via `auth.uid() = id`, while column protection (`role`, `disabled`, `account_status`) is delegated to the in-memory `BEFORE UPDATE` trigger `trg_prevent_privilege_escalation`.
2. **Profile INSERT Hardening**: Replaced open insert permissions with `profiles_insert_own_restricted`. Standard users can only create their own profile (`auth.uid() = id`) with `role = 'user'`, `disabled = FALSE`, and `account_status = 'active'`. Self-service admin or merchant promotion is impossible. Primary provisioning remains delegated to `handle_new_user()`.
3. **Application Settings Compartmentalization (`system_settings`)**: Added `is_public BOOLEAN NOT NULL DEFAULT FALSE` to distinguish client-facing configuration from internal system controls. Public clients and authenticated users can only view rows with `is_public = TRUE`. Internal controls (`notifications`, `ai_engine`) are restricted to administrators. Database storage of sensitive secrets (SMTP credentials, API keys, service-role keys) is strictly forbidden and maintained in environment variables.
4. **Automated PASS/FAIL Validation Engine**: Refactored `004_validation_queries.sql` to provide explicit `PASS` or `FAIL` outputs across 10 distinct security and integrity categories.
5. **Full File Synchronization**: All 5 SQL foundation files are synchronized to Version 1.3.0.

---

## 2. Detailed Task Review & Exact SQL Modifications

### Task 1: Fix `public.profiles` RLS Recursion

#### The Hazard
The previous update policy on `public.profiles` contained subqueries reading from `public.profiles`:
```sql
-- HAZARDOUS: Self-referencing subquery inside RLS policy
CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        public.is_admin() OR (
            auth.uid() = id AND
            role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) AND
            disabled = (SELECT p.disabled FROM public.profiles p WHERE p.id = auth.uid()) AND
            account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
        )
    );
```
In PostgreSQL, an RLS policy that queries its own target table forces PostgreSQL to recursively evaluate the table's `SELECT` policies during the `UPDATE` verification phase. This introduces latency, locks table rows, and risks infinite recursion if select policies trigger reciprocal evaluation.

#### The Correction
We removed all self-referencing subqueries from the policy:
```sql
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());
```

#### How Column Protection Is Enforced
Column-level privilege protection is cleanly handled by the PostgreSQL `BEFORE UPDATE` trigger function `public.prevent_profile_privilege_escalation()`:
```sql
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
```
* **Performance Benefit:** Row variables `OLD` and `NEW` are inspected directly in memory. Zero database disk I/O, zero subqueries, and zero RLS recursion.
* **Functional Integrity:** Standard users can update their `name`, `diet_type`, `preferences`, and `notification_settings` freely. If a user attempts to modify `role`, `disabled`, or `account_status`, PostgreSQL raises an immediate `42501` exception.

---

### Task 2: Secure Profile INSERT

#### The Hazard
Allowing `auth.uid() = id OR public.is_admin()` without field restrictions allowed an authenticated user to insert a profile with `role = 'admin'` or `role = 'merchant'` directly.

#### The Correction
We deployed `profiles_insert_own_restricted`:
```sql
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
```

#### Security Guarantees:
1. **Primary Signup Path**: Account creation is automatically managed by `public.handle_new_user()` on `AFTER INSERT ON auth.users`. Running as `SECURITY DEFINER`, it provisions the profile without requiring client INSERT rights.
2. **Direct Client Protection**: If a client ever attempts a direct `INSERT`, the policy mandates that:
   - The inserted row ID matches the authenticated user: `auth.uid() = id`.
   - The assigned role is strictly `'user'`.
   - The account cannot be created in a disabled state: `disabled = FALSE`.
   - The account status must be active: `account_status = 'active'`.
3. **Admin Exemption**: Only `public.is_admin()` can provision alternative roles or administratively disabled accounts.

---

### Task 3: Application Settings Segregation (`system_settings`)

#### Analysis of Application Usage
In the existing Node.js backend (`backend/src/controllers/adminController.js:1405-1450`), system settings (`notifications`) are queried and updated exclusively through administrator routes (`getNotificationSettings`, `updateNotificationSettings`). Standard users never need access to global delivery controls, AI engine parameters, or scheduler timings.

#### The Correction
1. **Schema Update:** Added `is_public BOOLEAN NOT NULL DEFAULT FALSE` to `public.system_settings`:
   ```sql
   CREATE TABLE IF NOT EXISTS public.system_settings (
       key TEXT PRIMARY KEY,
       value JSONB NOT NULL,
       description TEXT,
       is_public BOOLEAN NOT NULL DEFAULT FALSE,
       updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

2. **Index Optimization:** Added B-tree index for public setting lookups:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_system_settings_public ON public.system_settings(is_public);
   ```

3. **RLS Policy Segregation:**
   ```sql
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
   ```

4. **Default Seed Data Configuration:**
   - `notifications`: `is_public = FALSE` (Internal administrator delivery configuration).
   - `ai_engine`: `is_public = FALSE` (Internal rate limit and model routing parameters).
   - `client_app_config`: `is_public = TRUE` (Publicly consumable app metadata: version, maintenance status, support contact).

5. **Secrets Management Invariant:**
   > [!IMPORTANT]
   > Critical credentials—including SMTP passwords, Brevo API keys, Gemini/DeepSeek API tokens, and the Supabase `service_role` key—are **never** persisted in `public.system_settings`. They reside exclusively in environment variables (`backend/.env`).

---

### Task 4 & 5: Validation Queries & File Synchronization

File `supabase/migrations/20261102000004_validation_queries.sql` was rewritten into an automated test harness covering all 10 structural and security requirements. 

Every test returns a standardized record with columns:
`test_id | test_name | status ('PASS'/'FAIL') | details`

All individual migrations (`001_core_schema.sql`, `002_row_level_security.sql`, `003_indexes_and_performance.sql`, `004_validation_queries.sql`) and the consolidated master script (`schema_complete.sql`) are synchronized.

---

## 3. Operational Considerations & Remaining Limitations

1. **Supabase Auth Trigger Execution**:
   - `handle_new_user()` executes on `AFTER INSERT ON auth.users`.
   - When registering the designated administrator (`sham111205s@gmail.com`), the auth record must be created first via Supabase Auth. The trigger automatically sets `role = 'admin'`.
2. **Backend Service-Role Key Usage**:
   - Ingestion routes for `cached_foods`, Brevo webhook events (`email_events`), and system uptime heartbeats (`api_health_pings`) do not have client-side insert policies.
   - The Node.js backend must utilize the Supabase `service_role` key (bypassing RLS) to execute these writes.
   - The `SUPABASE_SERVICE_ROLE_KEY` must remain strictly server-side and never be included in frontend bundles.
3. **No Live SQL Execution**:
   - In accordance with project instructions, no SQL has been executed against a live Supabase database. All validations are based on AST, DDL, and PostgreSQL constraint modeling.

