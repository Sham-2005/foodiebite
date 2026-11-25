require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
const client = createClient(url, key);

async function testAuthUsers() {
  console.log('Testing Supabase login for test users...');
  const testUsers = [
    { email: 'kani@gmail.com', pass: 'Password123!' },
    { email: 'kani@gmail.com', pass: 'admin123' },
    { email: 'kani@gmail.com', pass: 'Admin@2026' },
    { email: 'shams5076.sse@saveetha.com', pass: 'Password123!' },
    { email: 'sham111205s@gmail.com', pass: 'Admin@2026' },
    { email: 'sham111205s@gmail.com', pass: 'admin123' },
    { email: 'sham111205s@gmail.com', pass: 'Password123!' },
    { email: 'regular_user@example.com', pass: 'Password123!' },
    { email: 'p1_test_user@foodiebite.test', pass: 'Password123!' }
  ];

  for (const u of testUsers) {
    const { data, error } = await client.auth.signInWithPassword({ email: u.email, password: u.pass });
    if (!error && data?.session) {
      console.log(` SUCCESS for ${u.email} (UID: ${data.user.id})`);
      const userToken = data.session.access_token;
      const userClient = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      });
      const { data: rep, error: rErr } = await userClient.from('medical_reports').select('*');
      console.log(`    medical_reports for ${u.email}: count = ${rep?.length || 0}`, rErr ? rErr.message : '');
      if (rep && rep.length > 0) {
        console.log('    Report data:', JSON.stringify(rep[0], null, 2));
      }
      return;
    }
  }
  console.log('None of the simple password attempts succeeded.');
}

testAuthUsers().catch(console.error);
