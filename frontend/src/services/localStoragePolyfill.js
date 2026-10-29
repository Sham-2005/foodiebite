import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = {};

if (Platform.OS !== 'web') {
  global.localStorage = {
    getItem: (key) => {
      return cache[key] !== undefined ? cache[key] : null;
    },
    setItem: (key, value) => {
      const strVal = String(value);
      cache[key] = strVal;
      AsyncStorage.setItem(key, strVal).catch(err => {
        console.warn('AsyncStorage setItem failed:', err);
      });
    },
    removeItem: (key) => {
      delete cache[key];
      AsyncStorage.removeItem(key).catch(err => {
        console.warn('AsyncStorage removeItem failed:', err);
      });
    },
    clear: () => {
      Object.keys(cache).forEach(k => delete cache[k]);
      AsyncStorage.clear().catch(err => {
        console.warn('AsyncStorage clear failed:', err);
      });
    },
    key: (index) => {
      return Object.keys(cache)[index] || null;
    },
    get length() {
      return Object.keys(cache).length;
    }
  };
}

export async function hydrateLocalStorage() {
  if (Platform.OS === 'web') {
    console.log('✅ Native localStorage is already available on web. Skipping hydration.');
    return;
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([key, val]) => {
      if (val !== null) {
        cache[key] = val;
      }
    });
    console.log('✅ Synchronous localStorage hydrated from AsyncStorage successfully. Total keys:', pairs.length);
  } catch (err) {
    console.error('❌ Failed to hydrate localStorage from AsyncStorage:', err);
  }
}
