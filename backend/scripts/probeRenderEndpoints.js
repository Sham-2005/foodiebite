const https = require('https');

function testUrl(url, headers = {}) {
  return new Promise((resolve) => {
    console.log(`Probing: ${url}`);
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.slice(0, 300) });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout after 15s' });
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function run() {
  const headers = { 'x-admin-key': 'foodiebite_ai_live_key_2026' };
  console.log('--- 1. Render Health ---');
  console.log(await testUrl('https://foodiebite-backend.onrender.com/api/coach/status'));

  console.log('--- 2. Render Admin Food Stats ---');
  console.log(await testUrl('https://foodiebite-backend.onrender.com/api/admin/foods/stats', headers));

  console.log('--- 3. Render Admin Medical Reports ---');
  console.log(await testUrl('https://foodiebite-backend.onrender.com/api/admin/users/kani@gmail.com/medical-reports', headers));
}

run();
