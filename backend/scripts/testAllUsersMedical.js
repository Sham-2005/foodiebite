const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'foodiebite_super_secret_key_change_in_production_2024';

async function checkUser(uid, email) {
  return new Promise(resolve => {
    const token = jwt.sign({ uid, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/medical/reports',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ email, status: res.statusCode, body }));
    });
    req.on('error', e => resolve({ email, error: e.message }));
    req.end();
  });
}

async function run() {
  const users = [
    { uid: 'przAq4SIPQWmvC61Xedj6Bb48nw1', email: 'kani@gmail.com' },
    { uid: '00000000-0000-4000-8000-000000000001', email: 'p1_test_user@foodiebite.test' },
    { uid: 'e7623d77-76dd-4e5f-8e30-d98600002e01', email: 'sham111205s@gmail.com' },
    { uid: 'usr_1795518545766', email: 'newuser_1795518545766@testfood.com' }
  ];
  for (const u of users) {
    const res = await checkUser(u.uid, u.email);
    console.log(u.email, '->', res.body);
  }
}

run().catch(console.error);
