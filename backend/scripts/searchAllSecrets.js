const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(walk(fullPath));
        } else if (file.includes('env') || file.includes('sql') || file.includes('config') || file.includes('secret')) {
          results.push(fullPath);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return results;
}

const files = walk('s:/files/food_app');
console.log('Checked files:', files.length);

files.forEach(f => {
  try {
    const text = fs.readFileSync(f, 'utf8');
    if (text.includes('service_role') || text.includes('SERVICE_ROLE') || text.includes('sb_secret') || text.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
      console.log('Found key in:', f);
      text.split('\n').forEach(l => {
        if (l.includes('service_role') || l.includes('SERVICE_ROLE') || l.includes('sb_secret') || l.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
          console.log('  Line:', l.trim().substring(0, 100));
        }
      });
    }
  } catch (_) {}
});
