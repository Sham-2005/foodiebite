const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/services/api.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import of apiConfig if not present
if (!content.includes('../config/apiConfig.js')) {
  content = content.replace(
    "import { isSupabaseConfigured, getSupabaseClient } from '../config/supabaseClient.js';",
    "import { isSupabaseConfigured, getSupabaseClient } from '../config/supabaseClient.js';\nimport { API_BASE_URL, BACKEND_BASE_URL, getApiUrl, getBackendUrl, getApiBaseUrl } from '../config/apiConfig.js';"
  );
}

// 2. Replace occurrences of `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}`
content = content.replace(/\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"]\}/g, '${API_BASE_URL}');

// 3. Replace definitions of API_BASE, MEDICAL_API_BASE, baseUrl, etc.
content = content.replace(/const API_BASE = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const API_BASE = API_BASE_URL;');
content = content.replace(/const MEDICAL_API_BASE = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const MEDICAL_API_BASE = API_BASE_URL;');
content = content.replace(/const baseUrl = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const baseUrl = API_BASE_URL;');

// 4. In apiSendChatMessage (L1832)
content = content.replace(
  "const isLocalhost = !(process.env.REACT_APP_API_URL) || process.env.REACT_APP_API_URL.includes('localhost');",
  "const isLocalhost = API_BASE_URL.includes('localhost');"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully migrated frontend/src/services/api.js to centralized apiConfig!');
