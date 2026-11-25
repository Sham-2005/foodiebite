const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/supabase/migrations/20261102000005_auth_foundation.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('sham111205s@gmail.com')) {
    console.log(lines.slice(Math.max(0, i - 5), i + 15).join('\n'));
    console.log('---');
  }
});
