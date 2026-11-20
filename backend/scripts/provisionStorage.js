// ─────────────────────────────────────────────────────────────
//  backend/scripts/provisionStorage.js
//  FoodieBite Supabase Storage Bucket Provisioning Script
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  'https://wzhxalmixfeqszgwqeqr.supabase.co';

const anonKey = process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  '';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

const BUCKET_NAME = 'medical-reports';

async function main() {
  console.log('====================================================');
  console.log(' FoodieBite Supabase Storage Provisioning');
  console.log('====================================================');
  console.log(`Target Supabase URL: ${supabaseUrl}`);
  console.log(`Target Bucket:       ${BUCKET_NAME}`);

  // 1. First test using anon/publishable client
  const publicClient = createClient(supabaseUrl, anonKey);
  const { data: existingBucket, error: getErr } = await publicClient.storage.getBucket(BUCKET_NAME);

  if (existingBucket && !getErr) {
    console.log(`\n✅ Bucket '${BUCKET_NAME}' already exists!`);
    console.log('   Public:', existingBucket.public);
    console.log('   File Size Limit:', existingBucket.file_size_limit);
    console.log('   Allowed MIME Types:', existingBucket.allowed_mime_types);
    return;
  }

  console.log(`\n⚠️ Bucket '${BUCKET_NAME}' does not exist on remote Supabase (Error: ${getErr?.message || 'Not found'}).`);

  // 2. If serviceRoleKey is present, provision via admin client
  if (serviceRoleKey && serviceRoleKey.trim() !== '') {
    console.log('\n🔑 Service role key detected. Attempting automatic bucket creation...');
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await adminClient.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 20971520, // 20 MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    });

    if (error) {
      console.error('❌ Failed to create bucket with service role key:', error.message);
    } else {
      console.log(`✅ Successfully created private bucket '${BUCKET_NAME}'!`, data);
      return;
    }
  } else {
    console.log('\nℹ️  SUPABASE_SERVICE_ROLE_KEY is not defined in backend/.env.');
  }

  // 3. Print instructions for Supabase Dashboard SQL Editor
  console.log('\n----------------------------------------------------');
  console.log('ACTION REQUIRED: Execute SQL in Supabase Dashboard');
  console.log('----------------------------------------------------');
  console.log('To create the bucket and configure RLS policies:');
  console.log(`1. Open: https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr/sql/new`);
  console.log('2. Paste and run the following idempotent SQL snippet:\n');
  console.log(`
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
DROP POLICY IF EXISTS "medical_reports_insert_own" ON storage.objects;
CREATE POLICY "medical_reports_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "medical_reports_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_select_own" ON storage.objects;
CREATE POLICY "medical_reports_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "medical_reports_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "medical_reports_update_own" ON storage.objects;
CREATE POLICY "medical_reports_update_own"
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
DROP POLICY IF EXISTS "medical_reports_delete_own" ON storage.objects;
CREATE POLICY "medical_reports_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'medical-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
`);
  console.log('----------------------------------------------------\n');
}

main().catch(console.error);
