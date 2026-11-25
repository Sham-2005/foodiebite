const http = require('http');

http.get('http://localhost:3000', (res) => {
  console.log('HTTP Status:', res.statusCode);
  let length = 0;
  res.on('data', chunk => length += chunk.length);
  res.on('end', () => console.log('Received HTML bytes:', length));
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
