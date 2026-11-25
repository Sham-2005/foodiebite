const fs = require('fs');
const path = require('path');

function searchDir(dir, needle) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'build') {
        searchDir(full, needle);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes(needle)) {
        console.log(`Found "${needle}" in ${full}`);
      }
    }
  }
}

searchDir('frontend/src', 'foodiebite_admin_session');
