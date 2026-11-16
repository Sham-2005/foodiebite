// ─────────────────────────────────────────────────────────────
//  frontend/src/services/googleAuth.js
//  Platform dispatcher for Google Authentication
//  Delegates to googleAuth.android on Android native
//  and googleAuth.web on Web/Desktop.
// ─────────────────────────────────────────────────────────────

import { loginWithGoogle as loginWithGoogleWeb, signOutFromGoogle as signOutFromGoogleWeb } from './googleAuth.web.js';

function isAndroidPlatform() {
  try {
    let p = null;
    try {
      p = require('react-native').Platform;
    } catch (_) {}
    if (p && p.OS === 'android') {
      return true;
    }
    const Platform = typeof global !== 'undefined' && global.Platform;
    if (Platform && Platform.OS === 'android') {
      return true;
    }
    if (typeof process !== 'undefined' && process.env?.PLATFORM === 'android') {
      return true;
    }
  } catch (_) { }
  return false;
}

export async function loginWithGoogle(options = {}) {
  if (isAndroidPlatform()) {
    try {
      const androidAuth = require('./googleAuth.android.js');
      if (androidAuth && typeof androidAuth.loginWithGoogle === 'function') {
        return androidAuth.loginWithGoogle(options);
      }
    } catch (_) {
      const { loginWithGoogle: loginWithGoogleAndroid } = await import('./googleAuth.android.js');
      return loginWithGoogleAndroid(options);
    }
  }

  // Default to web OAuth implementation
  return loginWithGoogleWeb(options);
}

export async function signOutFromGoogle() {
  if (isAndroidPlatform()) {
    try {
      const androidAuth = require('./googleAuth.android.js');
      if (androidAuth && typeof androidAuth.signOutFromGoogle === 'function') {
        return androidAuth.signOutFromGoogle();
      }
    } catch (_) {
      try {
        const { signOutFromGoogle: signOutFromGoogleAndroid } = await import('./googleAuth.android.js');
        if (typeof signOutFromGoogleAndroid === 'function') {
          return signOutFromGoogleAndroid();
        }
      } catch (_) {}
    }
  }
  return signOutFromGoogleWeb();
}

export default { loginWithGoogle, signOutFromGoogle };
