const fs = require('fs');
const files = fs.readdirSync('frontend/build').filter(f => f.endsWith('.js'));
files.forEach(f => {
  const c = fs.readFileSync('frontend/build/' + f, 'utf8');
  if (c.includes('localhost:5000')) {
    console.log(`Found localhost:5000 in ${f}`);
    const idx = c.indexOf('localhost:5000');
    console.log('Snippet:', c.slice(Math.max(0, idx - 100), Math.min(c.length, idx + 100)));
  }
});
