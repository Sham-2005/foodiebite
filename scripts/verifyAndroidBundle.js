const fs = require('fs');

const androidBundlePath = 'frontend/android/app/src/main/assets/index.android.bundle';
if (fs.existsSync(androidBundlePath)) {
  const c = fs.readFileSync(androidBundlePath, 'utf8');
  console.log('Android bundle contains foodiebite-backend.onrender.com:', c.includes('foodiebite-backend.onrender.com'));
} else {
  console.log('Android bundle not found');
}
