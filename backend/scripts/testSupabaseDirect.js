require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

async function testDirect() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  console.log('Testing Supabase direct with URL:', url);
  console.log('Using Key prefix:', key?.substring(0, 15));

  const client = createClient(url, key);

  // Test 1: profiles
  const { data: pData, error: pErr } = await client.from('profiles').select('id, email').limit(5);
  console.log('Profiles select result:');
  console.log('  Error:', pErr);
  console.log('  Data count:', pData?.length, pData);

  // Test 2: medical_reports
  const { data: mData, error: mErr } = await client.from('medical_reports').select('id, user_id, report_name').limit(5);
  console.log('\nMedical reports select result:');
  console.log('  Error:', mErr);
  console.log('  Data count:', mData?.length, mData);

  // Test 3: user_favorites
  const { data: fData, error: fErr } = await client.from('user_favorites').select('*').limit(5);
  console.log('\nUser favorites select result:');
  console.log('  Error:', fErr);
  console.log('  Data count:', fData?.length);
}

testDirect().catch(console.error);
