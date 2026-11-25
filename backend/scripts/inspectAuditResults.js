const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/scripts/audit_results.json', 'utf8');
console.log('Size:', content.length);
const data = JSON.parse(content);
console.log('Top keys:', Object.keys(data));
if (data.users) console.log('Users:', data.users);
if (data.reports) console.log('Reports:', data.reports);
if (data.tests) console.log('Tests count:', data.tests.length);
const matches = [];
JSON.stringify(data).replace(/"([^"]+)":/g, (m, k) => {
  if (k.toLowerCase().includes('medical') || k.toLowerCase().includes('report')) {
    matches.push(k);
  }
});
console.log('Unique medical/report keys:', Array.from(new Set(matches)));
