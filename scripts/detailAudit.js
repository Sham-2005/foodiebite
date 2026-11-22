const results = require('./audit_results.json');
const fs = require('fs');
const path = require('path');

const srcMatches = results.filter(r => r.file.startsWith('frontend/src/'));
const byFile = {};
srcMatches.forEach(r => {
  byFile[r.file] = byFile[r.file] || [];
  byFile[r.file].push(r);
});

console.log('=== FRONTEND/SRC FILES (' + Object.keys(byFile).length + ' files) ===');
for (const [f, matches] of Object.entries(byFile)) {
  console.log(`\nFILE: ${f} (${matches.length} matches)`);
  matches.forEach(m => {
    // Only show lines that actually have localhost or API or URLs
    if (/localhost|127\.0\.0\.1|5000|API_URL|foodiebite-backend|CLIENT_URL/i.test(m.text)) {
      console.log(`   L${m.line}: ${m.text}`);
    }
  });
}
