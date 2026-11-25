const { execSync } = require('child_process');
try {
  const log = execSync('git log -n 50 --grep="supabase\\|service_role" -p', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const matches = log.match(/service_role|SUPABASE_SERVICE_ROLE/gi);
  console.log('Git grep matches:', matches?.length);
  const lines = log.split('\n');
  lines.forEach(l => {
    if (l.includes('SERVICE_ROLE') || l.includes('service_role')) {
      console.log(l.substring(0, 100));
    }
  });
} catch (e) {
  console.error(e.message);
}
