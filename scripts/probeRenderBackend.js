const https = require('https');

const endpoints = [
  '/',
  '/health',
  '/ready',
  '/api',
  '/api/debug/ai',
  '/api/debug/supabase',
  '/api/debug/gemini',
  '/api/food/recommendations',
  '/api/coach/message'
];

async function checkEndpoint(ep) {
  return new Promise((resolve) => {
    const req = https.get('https://foodiebite-backend.onrender.com' + ep, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ ep, status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (err) => {
      resolve({ ep, status: 'ERROR', error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ep, status: 'TIMEOUT', error: 'Request timed out' });
    });
  });
}

async function run() {
  console.log('Testing Render live backend: https://foodiebite-backend.onrender.com ...');
  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`[${res.status}] ${ep} -> ${typeof res.body === 'string' ? res.body.substring(0, 120).replace(/\n/g, ' ') : res.error}`);
  }
}

run();
