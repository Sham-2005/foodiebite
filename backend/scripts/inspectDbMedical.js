require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { getSupabaseAdmin, getSupabaseClient } = require('../src/config/supabase');

async function inspectDb() {
  console.log('--- Inspecting Database for Medical Reports & Users ---');
  const client = getSupabaseAdmin() || getSupabaseClient();
  if (!client) {
    console.error('No Supabase client available! Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  // 1. Check medical_reports table
  const { data: reports, error: rErr } = await client
    .from('medical_reports')
    .select('*');
  
  if (rErr) {
    console.error('Error fetching medical_reports:', rErr.message);
  } else {
    console.log(`\nFound ${reports?.length || 0} medical reports in 'medical_reports':`);
    (reports || []).forEach((r, idx) => {
      console.log(`[Report #${idx + 1}] ID: ${r.id}, user_id: ${r.user_id}, report_name: "${r.report_name}", storage_path: "${r.storage_path}", created_at: ${r.created_at}`);
      console.log(`  original_filename: "${r.original_filename}"`);
      console.log(`  has raw_ocr_text: ${Boolean(r.raw_ocr_text)} (len: ${r.raw_ocr_text?.length || 0})`);
      console.log(`  has analysis: ${Boolean(r.analysis && Object.keys(r.analysis).length > 0)}`);
      console.log(`  processing_status: ${r.processing_status}`);
    });
  }

  // 2. Check profiles
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, email, name, full_name, created_at');
  if (pErr) {
    console.error('Error fetching profiles:', pErr.message);
  } else {
    console.log(`\nFound ${profiles?.length || 0} profiles:`);
    (profiles || []).forEach((p, idx) => {
      console.log(`[Profile #${idx + 1}] ID: ${p.id}, email: "${p.email}", name: "${p.name || p.full_name}"`);
    });
  }

  // 3. Check auth.users if accessible via admin
  if (client.auth && client.auth.admin) {
    const { data: authUsers, error: aErr } = await client.auth.admin.listUsers();
    if (aErr) {
      console.warn('Auth admin listUsers note:', aErr.message);
    } else {
      console.log(`\nFound ${authUsers?.users?.length || 0} auth users:`);
      (authUsers?.users || []).forEach((u, idx) => {
        console.log(`[Auth User #${idx + 1}] ID: ${u.id}, email: "${u.email}"`);
      });
    }
  }

  // 4. Check storage buckets
  const { data: buckets, error: bErr } = await client.storage.listBuckets();
  if (bErr) {
    console.warn('List buckets note:', bErr.message);
  } else {
    console.log(`\nStorage Buckets (${buckets?.length || 0}):`);
    (buckets || []).forEach(b => console.log(`  - Bucket: "${b.name}", public: ${b.public}`));
  }

  // 5. Check files in 'medical-reports' bucket
  const { data: files, error: fErr } = await client.storage.from('medical-reports').list('', { limit: 100 });
  if (fErr) {
    console.warn('List medical-reports root files note:', fErr.message);
  } else {
    console.log(`\nFiles in 'medical-reports' bucket root (${files?.length || 0}):`);
    for (const f of files || []) {
      console.log(`  - ${f.name} (id: ${f.id || 'folder'})`);
      const { data: subFiles } = await client.storage.from('medical-reports').list(f.name, { limit: 20 });
      (subFiles || []).forEach(sf => console.log(`      -> ${f.name}/${sf.name}`));
    }
  }
}

inspectDb().catch(console.error);
