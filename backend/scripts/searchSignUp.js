const fs = require('fs');
const path = require('path');

function searchCode(dir, term) {
  let res = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      if (f === 'node_modules' || f === '.git') return;
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        res = res.concat(searchCode(full, term));
      } else if (f.endsWith('.js') || f.endsWith('.sql') || f.endsWith('.json')) {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes(term)) res.push(full);
      }
    });
  } catch (_) {}
  return res;
}

console.log('Files with signUp:', searchCode('s:/files/food_app', 'auth.signUp'));
console.log('Files with admin.createUser:', searchCode('s:/files/food_app', 'admin.createUser'));
