const fs = require('fs');

function showMatches(file, needle) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`=== ${file} ===`);
  lines.forEach((l, i) => {
    if (l.includes(needle)) {
      console.log(`${i+1}: ${l.trim()}`);
    }
  });
}

showMatches('frontend/src/context/AppContext.js', 'foodiebite_admin_session');
showMatches('frontend/src/screens/AdminDashboardScreen.js', 'foodiebite_admin_session');
