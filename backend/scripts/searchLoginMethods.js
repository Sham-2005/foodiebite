const fs = require('fs');
const path = require('path');

function search(dir, str) {
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules') res = res.concat(search(full, str));
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes(str)) res.push(full);
    }
  });
  return res;
}

console.log('Files with signInWithOAuth:', search('s:/files/food_app/frontend/src', 'signInWithOAuth'));
console.log('Files with signInWithPassword:', search('s:/files/food_app/frontend/src', 'signInWithPassword'));
console.log('Files with apiLogin:', search('s:/files/food_app/frontend/src', 'apiLogin'));
