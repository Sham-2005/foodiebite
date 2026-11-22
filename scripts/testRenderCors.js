const https = require('https');

function testOrigin(origin) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'foodiebite-backend.onrender.com',
      port: 443,
      path: '/health',
      method: 'GET',
      headers: {
        'Origin': origin
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          origin,
          statusCode: res.statusCode,
          allowOrigin: res.headers['access-control-allow-origin'],
          body: data
        });
      });
    });

    req.on('error', (e) => {
      resolve({ origin, error: e.message });
    });

    req.end();
  });
}

async function run() {
  const origins = [
    'https://sham-2005.github.io',
    'http://localhost:3000',
    'https://foodiebite-backend.onrender.com',
    'null'
  ];

  for (const o of origins) {
    const res = await testOrigin(o);
    console.log(`Origin: ${o} -> Status: ${res.statusCode}, Access-Control-Allow-Origin: ${res.allowOrigin}`);
  }
}

run();
