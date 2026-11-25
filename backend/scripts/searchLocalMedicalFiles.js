const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'build') continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = results.concat(searchFiles(full));
      } else {
        const lower = item.name.toLowerCase();
        if (lower.includes('report') || lower.includes('medical') || lower.endsWith('.pdf')) {
          results.push(full);
        }
      }
    }
  } catch (e) {}
  return results;
}

const found = searchFiles('s:/files/food_app');
console.log('Found medical/report files on disk:');
found.forEach(f => console.log(' -', f));
