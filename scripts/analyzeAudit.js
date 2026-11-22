const results = require('./audit_results.json');

console.log('Total matches:', results.length);

const frontendMatches = results.filter(r => r.file.startsWith('frontend/'));
const fileMap = {};
frontendMatches.forEach(r => {
  fileMap[r.file] = fileMap[r.file] || [];
  fileMap[r.file].push({ line: r.line, text: r.text });
});

console.log('\n--- FRONTEND MATCHES BY FILE ---');
for (const [file, items] of Object.entries(fileMap)) {
  console.log(`\nFile: ${file} (${items.length} matches)`);
  items.slice(0, 5).forEach(i => console.log(`  Line ${i.line}: ${i.text.slice(0, 100)}`));
}

const backendMatches = results.filter(r => r.file.startsWith('backend/'));
const backendFileMap = {};
backendMatches.forEach(r => {
  backendFileMap[r.file] = backendFileMap[r.file] || [];
  backendFileMap[r.file].push({ line: r.line, text: r.text });
});

console.log('\n--- BACKEND MATCHES BY FILE ---');
for (const [file, items] of Object.entries(backendFileMap)) {
  console.log(`\nFile: ${file} (${items.length} matches)`);
  items.slice(0, 3).forEach(i => console.log(`  Line ${i.line}: ${i.text.slice(0, 100)}`));
}
