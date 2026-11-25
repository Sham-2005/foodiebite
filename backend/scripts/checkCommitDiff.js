const { execSync } = require('child_process');
try {
  const diff = execSync('git diff 1d395a59 9caf711c -- backend/src/controllers/medicalController.js', { encoding: 'utf8' });
  console.log('Diff size:', diff.length);
  // print first 100 lines
  console.log(diff.split('\n').slice(0, 100).join('\n'));
} catch (e) {
  console.error(e.message);
}
