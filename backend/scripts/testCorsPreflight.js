const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin/users/kani@gmail.com/medical-reports',
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:3000',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'x-admin-key, authorization, content-type'
  }
};

const req = http.request(options, (res) => {
  console.log('OPTIONS Status:', res.statusCode);
  console.log('Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
  console.log('Access-Control-Allow-Headers:', res.headers['access-control-allow-headers']);
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
