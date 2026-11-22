const fs = require('fs');
const files = fs.readdirSync('frontend/build').filter(f => f.endsWith('.js'));
let hasRender = false;
let hasLocalhost5000 = false;
files.forEach(f => {
  const c = fs.readFileSync('frontend/build/' + f, 'utf8');
  if (c.includes('foodiebite-backend.onrender.com')) hasRender = true;
  if (c.includes('localhost:5000')) hasLocalhost5000 = true;
});
console.log('Build check results:');
console.log('Includes foodiebite-backend.onrender.com:', hasRender);
console.log('Includes localhost:5000 backend:', hasLocalhost5000);
