const { createClient } = require('@supabase/supabase-js');
const url = 'https://wzhxalmixfeqszgwqeqr.supabase.co';
const anonKey = 'sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB';

const supabase = createClient(url, anonKey);

async function check() {
  console.log('Testing anon client...');
  const { data: demo } = await supabase.from('foodiebite_demo').select('*');
  console.log('foodiebite_demo count:', demo ? demo.length : 0);

  // Try signing in with known test accounts to see if we can get a session
  const testEmails = ['kani@gmail.com', 'shams5076.sse@saveetha.com', 'sham111205s@gmail.com'];
  const testPasses = ['Password@123', 'Admin@2026', 'admin123', 'Sham@123', 'kani123'];

  for (const email of testEmails) {
    for (const pass of testPasses) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (!error && data?.session) {
        console.log(`Signed in successfully as ${email}! User ID:`, data.user.id);
        const userClient = createClient(url, anonKey, {
          global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
        });
        const { data: reports, error: rErr } = await userClient.from('medical_reports').select('*');
        console.log(`User ${email} medical_reports:`, reports ? reports.length : rErr?.message);
        if (reports && reports.length > 0) {
          console.log('Reports details:', reports);
        }
        const { data: myProfile } = await userClient.from('profiles').select('*');
        console.log(`User ${email} profile:`, myProfile);
        break;
      }
    }
  }
}

check().catch(console.error);
