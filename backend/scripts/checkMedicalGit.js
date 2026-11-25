const { execSync } = require('child_process');
try {
  const log = execSync('git log -n 5 --oneline backend/src/controllers/medicalController.js', { encoding: 'utf8' });
  console.log('Recent commits to medicalController.js:\n', log);
} catch (e) {
  console.error(e.message);
}
