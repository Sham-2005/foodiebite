const fs = require('fs');
const path = require('path');

function searchUsage(dir, term) {
  let res = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        res = res.concat(searchUsage(full, term));
      } else if (f.endsWith('.js')) {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes(term)) res.push(full);
      }
    });
  } catch (_) {}
  return res;
}

console.log('persistentReportDb usage:', searchUsage('s:/files/food_app/backend', 'persistentReportDb'));
