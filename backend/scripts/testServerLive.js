const http = require('http');

http.get('http://localhost:5000/api/coach/status', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Backend port 5000 is UP! Status:', res.statusCode);
    console.log('Body:', body);
  });
}).on('error', (err) => {
  console.log('Backend port 5000 not reachable:', err.message);
});
