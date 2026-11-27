# FOODIEBITE — SUPABASE STORAGE 'BUCKET NOT FOUND' INVESTIGATION & REMEDIATION REPORT

**Date:** November 19, 2026  
**Application:** FoodieBite (`com.foodiebite.app`)  
**Platforms:** Web (React / Webpack) & Android (React Native / Hermes)  
**Target Provider:** Supabase Storage & PostgreSQL (`https://wzhxalmixfeqszgwqeqr.supabase.co`)  
**Status:** Root Cause Identified, Automated Diagnostics Verified, SQL Migration Prepared  

---

## 1. Executive Summary

During testing of the FoodieBite Web application on the Medical Reports screen (`/medical-reports`), uploading any PDF document triggered the following user-facing error:

```text
"Storage upload failed: Bucket not found"
```

A live, direct programmatic diagnostic of the Supabase project confirmed that:
1. The remote Supabase PostgreSQL database is connected and active.
2. The `public.medical_reports` table exists and is accessible.
3. The storage bucket `medical-reports` **does not exist** on the remote Supabase project (HTTP 404 `NoSuchBucket`).
4. The migration script [`20261118000007_storage_and_medical_reports_hardening.sql`](file:///s:/files/food_app/supabase/migrations/20261118000007_storage_and_medical_reports_hardening.sql) was written locally in the repository, but has **not yet been executed** on the remote Supabase database instance.

---

## 2. Phase 1 — Root Cause Investigation

### Diagnostic Trace

A live Node.js diagnostic probe was executed against the configured Supabase endpoint:
- **Project URL:** `https://wzhxalmixfeqszgwqeqr.supabase.co` (Ref: `wzhxalmixfeqszgwqeqr`)
- **Key Type:** Publishable / Anon Client (`sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB`)

```javascript
const { data: bucketData, error: bucketErr } = await client.storage.getBucket('medical-reports');
```

**Diagnostic Output:**
```json
{
  "exists": false,
  "error": "Bucket not found",
  "status": 400,
  "statusCode": "404",
  "code": "NoSuchBucket"
}
```

When querying `client.storage.listBuckets()`, the live Supabase project returned `[]` (0 buckets found).

### Root Cause Analysis

1. **Local Migration vs. Remote Execution:**
   Supabase is a cloud-hosted managed PostgreSQL instance. Writing an SQL migration file to `supabase/migrations/` in the local git repository does **not** push or apply the DDL to the remote cloud database unless it is deployed via the Supabase CLI (`supabase db push`) or pasted into the **Supabase Dashboard SQL Editor**.
2. **PostgreSQL RLS on `storage.buckets`:**
   By default in Supabase, the `storage.buckets` table has Row-Level Security enabled. Public/anon API keys and standard authenticated users are denied permission (`403 AccessDenied`) to execute `client.storage.createBucket()`. Only the database superuser (`postgres` role in SQL Editor) or the privileged `service_role` key can register new buckets.
3. **Execution Failure in the Web Application:**
   In [`medicalReportsService.js`](file:///s:/files/food_app/frontend/src/services/medicalReportsService.js), `uploadAndPersistMedicalReport()` attempts to upload the physical document to `client.storage.from('medical-reports').upload()`. Because Supabase Storage has no bucket named `medical-reports`, it rejects the request with HTTP 404 `Bucket not found`.

---

## 3. Phase 2 — Verified Bucket Configuration

The expected bucket configuration for FoodieBite is:

| Parameter | Required Value | Rationale |
| :--- | :--- | :--- |
| **Bucket ID / Name** | `medical-reports` | Matches all references in frontend and backend |
| **Public Access** | `false` (Private) | Medical records contain protected health information (PHI) |
| **File Size Limit** | `20971520` (20 MB) | Accommodates multi-page high-resolution lab PDFs |
| **Allowed MIME Types** | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` | Clinical lab reports and scanned imaging |

### Idempotent SQL Definition:

```sql
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
```

---

## 4. Phase 3 — Storage Row-Level Security (RLS) Policies

All uploaded files are organized by user ownership using the strict storage path convention:

$$\text{Storage Path} = \text{\{authenticated\_user\_id\}}/\text{\{report\_id\}}-\text{\{sanitized\_filename\}}$$

Using Supabase's `storage.foldername(name)`, the first path segment `(storage.foldername(name))[1]` resolves to the authenticated user ID.

```sql
-- 1. INSERT: Authenticated users can upload exclusively to their own folder
DROP POLICY IF EXISTS "medical_reports_storage_insert_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2. SELECT: Users can generate signed URLs / view only their own files
DROP POLICY IF EXISTS "medical_reports_storage_select_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. UPDATE: Users can modify metadata only within their own folder
DROP POLICY IF EXISTS "medical_reports_storage_update_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_update_own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4. DELETE: Users can delete only their own files
DROP POLICY IF EXISTS "medical_reports_storage_delete_own" ON storage.objects;
CREATE POLICY "medical_reports_storage_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
```

---

## 5. Phase 4 — Database Insertion & Rollback Verification

Metadata insertion into `public.medical_reports` has been verified against the live PostgreSQL table schema:

1. **Schema Field Compliance:**
   - `id`: UUID (Primary Key)
   - `user_id`: UUID (Foreign Key to `public.profiles(id)`)
   - `report_name`: TEXT
   - `original_filename`: TEXT
   - `storage_path`: TEXT (`{userId}/{reportId}-{cleanFileName}`)
   - `file_url`: TEXT (Signed URL or confirmed storage path)
   - `file_size_bytes`: BIGINT
   - `mime_type`: TEXT
   - `document_type`: TEXT (`digital_pdf` or `lab_image`, satisfying the `CHECK` constraint)
   - `processing_status`: TEXT (`completed`, `processing`, or `ocr_failed`)
   - `ocr_confidence`: NUMERIC(5,2)
   - `raw_ocr_text`: TEXT
   - `notes`: TEXT
   - `extracted_data`: JSONB (`patientInformation`, `medicalInformation`, `testResults`)
   - `analysis`: JSONB (`biomarkers`, `wellnessConcerns`, `healthScores`, `foodProfile`)
   - `created_at` / `updated_at`: TIMESTAMPTZ

2. **Atomic Rollback:**
   If `client.from('medical_reports').insert()` fails for any reason, the service immediately calls:
   ```javascript
   await client.storage.from('medical-reports').remove([confirmedStoragePath]);
   ```
   This guarantees zero orphaned files in storage.

---

## 6. Phase 5 — Cross-Platform Alignment (Web & Android)

Both platforms use the identical pipeline:

- **Supabase Project:** `https://wzhxalmixfeqszgwqeqr.supabase.co`
- **Bucket:** `medical-reports`
- **Storage Path:** `${userId}/${reportId}-${cleanFileName}`
- **Database Table:** `public.medical_reports`
- **Auth Provider:** Supabase GoTrue Auth (`auth.uid()`)

### Error Messaging Enhancement:
Updated [`frontend/src/services/medicalReportsService.js`](file:///s:/files/food_app/frontend/src/services/medicalReportsService.js) to catch `Bucket not found` specifically and provide actionable troubleshooting guidance:
```javascript
if (uploadErr) {
  if (
    uploadErr.message?.toLowerCase().includes('bucket not found') ||
    uploadErr.statusCode === '404' ||
    uploadErr.status === 404
  ) {
    throw new Error(
      `Storage upload failed: Bucket not found. The 'medical-reports' private storage bucket has not been provisioned in Supabase yet. Please execute the bucket creation SQL in the Supabase Dashboard SQL Editor or run 'node backend/scripts/provisionStorage.js'.`
    );
  }
  throw new Error(`Storage upload failed: ${uploadErr.message}`);
}
```

---

## 7. Phase 6 & 7 — Test Results & Resolution

### Automated Diagnostic Test Suite
Created and executed [`frontend/src/services/__tests__/bucketNotFoundDiagnosisAndFix.test.mjs`](file:///s:/files/food_app/frontend/src/services/__tests__/bucketNotFoundDiagnosisAndFix.test.mjs):
- **Results:** **8 / 8 tests passed (100%)**
- Confirmed live connection to `https://wzhxalmixfeqszgwqeqr.supabase.co`.
- Confirmed live diagnosis of HTTP 404 `NoSuchBucket`.
- Confirmed `public.medical_reports` table exists and is accessible.
- Confirmed file validation (PDF, JPEG, PNG, 20MB limit).
- Confirmed path formatting for RLS compatibility.
- Confirmed PostgreSQL `document_type` CHECK constraint mapping.
- Confirmed in-memory cache isolation (0 permanent disk writes).
- Confirmed signed URL generation without redundant prefix.

### Production Build Verification
- **Webpack Production Build:** `webpack 5.109.2 compiled successfully in 44027 ms` with **0 errors and 0 warnings**.
- **Backend Regression Suite:** 15/15 tests passed in `p1SupabaseBackendIntegration.test.js`.

### Live Upload Verification Status
> [!IMPORTANT]
> **Live Supabase Upload Status: Unverified on remote cloud instance.**  
> Because the remote cloud Supabase project does not yet have the `medical-reports` bucket created in `storage.buckets`, live uploads cannot succeed until the idempotent SQL snippet below is executed in the Supabase Dashboard SQL Editor.

---

## 8. Immediate Resolution Instructions

### Option 1: Supabase Dashboard SQL Editor (Recommended — Takes 30 seconds)
1. Open the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr/sql/new).
2. Paste the following SQL and click **Run**:

```sql
-- 1. Create the private 'medical-reports' bucket
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

-- 2. Configure Row Level Security on storage.objects
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
    )
    WITH CHECK (
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
```

### Option 2: Automated Script via Service Role Key
If you have the Supabase `service_role` key:
1. Add `SUPABASE_SERVICE_ROLE_KEY=your_secret_key` to `backend/.env`.
2. Run:
   ```bash
   node backend/scripts/provisionStorage.js
   ```
   The script will automatically provision the bucket via the Supabase Admin API.
