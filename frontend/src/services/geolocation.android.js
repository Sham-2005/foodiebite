import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export async function getCurrentPosition(success, error, options) {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'FoodieBite needs access to your location for local seasonal weather recommendations.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        if (error) error(new Error('Location permission denied'));
        return;
      }
    } catch (err) {
      if (error) error(err);
      return;
    }
  }

  Geolocation.getCurrentPosition(success, error, {
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 10000,
    ...options
  });
}
