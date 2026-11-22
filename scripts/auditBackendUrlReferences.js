const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.system_generated',
  'build',
  'dist',
  'android/build',
  'android/app/build',
  '.gradle',
  'Test Results',
  'Vulnerability Test Results',
  'reports'
]);

const IGNORE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.xlsx', '.jar', '.aar', '.class', '.zip', '.tar', '.gz'
]);

const PATTERNS = [
  /localhost/gi,
  /127\.0\.0\.1/gi,
  /5000/g,
  /3000/g,
  /8080/g,
  /10000/g,
  /foodiebite-backend/gi,
  /API_BASE_URL/gi,
  /API_URL/gi,
  /REACT_APP_API_URL/gi,
  /NEXT_PUBLIC_API_URL/gi,
  /VITE_API_URL/gi,
  /capacitor/gi,
  /com\.foodiebite\.app/gi,
  /google-signin/gi,
  /oauth/gi
];

const results = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || Array.from(IGNORE_DIRS).some(d => relPath.split(path.sep).includes(d))) {
        continue;
      }
      scanDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORE_EXTENSIONS.has(ext)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);

        lines.forEach((line, index) => {
          for (const pattern of PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(line)) {
              results.push({
                file: relPath.replace(/\\/g, '/'),
                line: index + 1,
                matched: pattern.toString(),
                text: line.trim()
              });
              break; // match once per line
            }
          }
        });
      } catch (err) {
        // ignore unreadable/binary
      }
    }
  }
}

scanDir(ROOT_DIR);

fs.writeFileSync(
  path.join(ROOT_DIR, 'scripts', 'audit_results.json'),
  JSON.stringify(results, null, 2)
);

console.log(`Audit complete. Found ${results.length} references across codebase.`);

// Group by category/file
const fileCounts = {};
results.forEach(r => {
  const category = r.file.split('/')[0];
  fileCounts[category] = (fileCounts[category] || 0) + 1;
});
console.log('Summary by top directory:', fileCounts);
