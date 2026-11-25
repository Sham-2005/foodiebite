const fs = require('fs');
const path = require('path');

function searchPg(dir) {
  let res = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      if (f === 'node_modules' || f === '.git') return;
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        res = res.concat(searchPg(full));
      } else {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes('postgres://') || c.includes('postgresql://') || c.includes('db.wzhxalmixfeqszgwqeqr.supabase.co')) {
          res.push(full);
        }
      }
    });
  } catch (_) {}
  return res;
}

console.log('Files with postgres connection:', searchPg('s:/files/food_app'));
