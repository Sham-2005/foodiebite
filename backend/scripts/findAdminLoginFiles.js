const fs = require('fs');
const path = require('path');
function search(dir) {
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules') res = res.concat(search(full));
    } else if (f.endsWith('.js')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('apiAdminLogin') || c.includes('admin/login') || c.includes('setAdminToken')) {
        res.push(full);
      }
    }
  });
  return res;
}
console.log('Files with Admin login:', search('s:/files/food_app/frontend/src'));
