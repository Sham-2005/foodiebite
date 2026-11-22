const https = require('https');

const tests = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/ready' },
  { method: 'GET', path: '/api/debug/ai' },
  { method: 'GET', path: '/api/debug/supabase' },
  { method: 'GET', path: '/api/food/recommendations' },
  { method: 'GET', path: '/api/foods/search?q=apple' },
  { method: 'GET', path: '/api/email/status' },
  { method: 'GET', path: '/api/auth/me' }, // should be 401 unauthorized
  { method: 'GET', path: '/api/admin/metrics/overview' }, // should be 401 unauthorized
  { method: 'POST', path: '/api/coach', body: JSON.stringify({ message: 'Hello' }), headers: { 'Content-Type': 'application/json' } }
];

async function runTest(t) {
  return new Promise((resolve) => {
    const postData = t.body || '';
    const headers = {
      'User-Agent': 'FoodieBite-Verification/1.0',
      ...(t.headers || {})
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request({
      hostname: 'foodiebite-backend.onrender.com',
      port: 443,
      path: t.path,
      method: t.method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          endpoint: `${t.method} ${t.path}`,
          status: res.statusCode,
          sample: data.slice(0, 150).replace(/\n/g, ' ')
        });
      });
    });

    req.on('error', err => resolve({ endpoint: `${t.method} ${t.path}`, status: 'ERR', sample: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Testing Render Production Backend API endpoints...');
  for (const t of tests) {
    const r = await runTest(t);
    console.log(`[${r.status}] ${r.endpoint} -> ${r.sample}`);
  }
}

main();
