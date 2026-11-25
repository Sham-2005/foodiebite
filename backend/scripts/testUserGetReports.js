const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'foodiebite_super_secret_key_change_in_production_2024';
const token = jwt.sign(
  { uid: 'c9662dab-f656-459d-9df7-71e9e1404160', email: 'shams5076.sse@saveetha.com', role: 'user' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('Testing GET /api/medical/reports with token for shams5076.sse@saveetha.com...');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/medical/reports',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', e => console.error(e.message));
req.end();
