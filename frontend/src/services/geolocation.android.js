// ─────────────────────────────────────────────────────────────
//  frontend/src/services/geolocation.android.js
//  Android runtime location permission request and geolocation.
// ─────────────────────────────────────────────────────────────

import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export async function getCurrentPosition(success, error, options = {}) {
  const safeError = (err) => {
    if (typeof error === 'function') {
      try {
        error(err instanceof Error ? err : new Error(String(err?.message || err)));
      } catch (_) {}
    }
  };

  const safeSuccess = (pos) => {
    if (typeof success === 'function') {
      try {
        success(pos);
      } catch (_) {}
    }
  };

  if (Platform.OS === 'android') {
    try {
      const hasFine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const hasCoarse = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (!hasFine && !hasCoarse) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'FoodieBite needs access to your location to recommend seasonal, weather-aligned foods nearby.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        if (
          granted !== PermissionsAndroid.RESULTS.GRANTED &&
          granted !== true
        ) {
          safeError(new Error('Location permission was denied. Defaulting to standard location.'));
          return;
        }
      }
    } catch (permErr) {
      safeError(permErr);
      return;
    }
  }

  try {
    if (!Geolocation || typeof Geolocation.getCurrentPosition !== 'function') {
      safeError(new Error('Geolocation native module is not available.'));
      return;
    }

    Geolocation.getCurrentPosition(
      safeSuccess,
      safeError,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      }
    );
  } catch (geoErr) {
    safeError(geoErr);
  }
}

export default { getCurrentPosition };
