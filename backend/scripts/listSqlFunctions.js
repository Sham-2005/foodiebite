const fs = require('fs');
const path = require('path');
const dir = 's:/files/food_app/supabase/migrations';
fs.readdirSync(dir).forEach(f => {
  if (f.endsWith('.sql')) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    text.split('\n').forEach((l, idx) => {
      if (l.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)) {
        console.log(`${f}:${idx+1}: ${l.trim()}`);
      }
    });
  }
});
