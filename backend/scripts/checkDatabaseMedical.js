const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getSupabaseAdmin, getSupabaseClient } = require('../src/config/supabase');

async function checkMedicalData() {
  const client = getSupabaseAdmin() || getSupabaseClient();
  if (!client) {
    console.error('No Supabase client configured.');
    return;
  }

  console.log('--- 1. CHECKING medical_reports TABLE ---');
  const { data: reports, error: rErr } = await client
    .from('medical_reports')
    .select('*');
  
  if (rErr) {
    console.error('Error querying medical_reports:', rErr.message);
  } else {
    console.log(`Found ${reports ? reports.length : 0} reports in medical_reports table.`);
    if (reports && reports.length > 0) {
      reports.forEach(r => {
        console.log(`  - ID: ${r.id}, User ID: ${r.user_id}, Name: ${r.report_name}, Status: ${r.processing_status}, Storage: ${r.storage_path}, Created: ${r.created_at}`);
      });
    }
  }

  console.log('\n--- 2. CHECKING profiles TABLE ---');
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, email, name, role');
  if (pErr) {
    console.error('Error querying profiles:', pErr.message);
  } else {
    console.log(`Found ${profiles ? profiles.length : 0} profiles.`);
    if (profiles && profiles.length > 0) {
      profiles.forEach(p => console.log(`  - Profile ID: ${p.id}, Email: ${p.email}, Name: ${p.name}, Role: ${p.role}`));
    }
  }

  console.log('\n--- 3. CHECKING Supabase Storage: medical-reports bucket ---');
  try {
    const { data: buckets, error: bErr } = await client.storage.listBuckets();
    console.log('Buckets:', buckets ? buckets.map(b => b.name) : bErr?.message);

    const { data: files, error: fErr } = await client.storage.from('medical-reports').list('', { limit: 100 });
    if (fErr) {
      console.error('Error listing medical-reports root:', fErr.message);
    } else {
      console.log(`Found ${files ? files.length : 0} items in medical-reports bucket root:`, files);
    }

    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        const { data: uFiles } = await client.storage.from('medical-reports').list(p.id);
        if (uFiles && uFiles.length > 0) {
          console.log(`Found ${uFiles.length} files under user folder ${p.id} (${p.email}):`, uFiles.map(f => f.name));
        }
      }
    }
  } catch (sErr) {
    console.error('Storage check error:', sErr.message);
  }

  console.log('\n--- 4. CHECKING email attachments or logs ---');
  try {
    const { data: logs, error: lErr } = await client.from('email_delivery_logs').select('*').limit(5);
    if (!lErr && logs) {
      console.log(`Found ${logs.length} email delivery logs.`);
      logs.forEach(l => console.log(`  - To: ${l.recipient_email}, Subject: ${l.subject}, Status: ${l.status}, Created: ${l.created_at}`));
    }
  } catch (e) {}
}

checkMedicalData().catch(console.error);
