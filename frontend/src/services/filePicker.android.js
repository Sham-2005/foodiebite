// ─────────────────────────────────────────────────────────────
//  frontend/src/services/filePicker.android.js
//  Android file, gallery, and camera picker with graceful runtime permissions.
// ─────────────────────────────────────────────────────────────

import DocumentPicker, { types } from 'react-native-document-picker';
import { PermissionsAndroid, Platform } from 'react-native';

let RNImagePicker = null;
try {
  RNImagePicker = require('react-native-image-picker');
} catch (_) {
  RNImagePicker = null;
}

/**
 * Request camera permission gracefully on Android.
 */
export async function requestCameraPermission() {
  if (Platform.OS !== 'android') return true;

  try {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA
    );
    if (alreadyGranted) return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'FoodieBite needs camera access to photograph nutrition labels or medical reports.',
        buttonNeutral: 'Ask Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );

    return (
      granted === PermissionsAndroid.RESULTS.GRANTED ||
      granted === true
    );
  } catch (err) {
    console.warn('Camera permission request error:', err);
    return false;
  }
}

/**
 * Request gallery / media permissions gracefully on Android.
 * Checks READ_MEDIA_IMAGES for API 33+ (Android 13+), or READ_EXTERNAL_STORAGE for API <= 32.
 */
export async function requestGalleryPermission() {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Number(Platform.Version) || 30;

    if (apiLevel >= 33) {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      if (alreadyGranted) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: 'Photo Library Permission',
          message: 'FoodieBite needs photo library access to select nutrition labels and food images.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      return (
        granted === PermissionsAndroid.RESULTS.GRANTED ||
        granted === true
      );
    } else {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      if (alreadyGranted) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'FoodieBite needs storage access to select photos from your device storage.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      return (
        granted === PermissionsAndroid.RESULTS.GRANTED ||
        granted === true
      );
    }
  } catch (err) {
    console.warn('Gallery permission request error:', err);
    return true; // continue gracefully to picker
  }
}

/**
 * Launch device camera safely.
 * Returns { assets: [{ uri, fileName, type, fileSize }] } or { didCancel: true, error?: string }
 */
export async function launchCamera(options = {}) {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return {
        didCancel: true,
        error: 'Camera permission was denied. You can still select an image from your gallery.',
      };
    }

    if (RNImagePicker && typeof RNImagePicker.launchCamera === 'function') {
      return await new Promise((resolve) => {
        RNImagePicker.launchCamera(
          {
            mediaType: 'photo',
            cameraType: 'back',
            quality: 0.85,
            saveToPhotos: false,
            ...options,
          },
          (response) => {
            if (response.didCancel) {
              resolve({ didCancel: true });
            } else if (response.errorCode || response.errorMessage) {
              resolve({ didCancel: true, error: response.errorMessage || response.errorCode });
            } else if (response.assets && response.assets.length > 0) {
              resolve({
                assets: response.assets.map(a => ({
                  uri: a.uri,
                  fileName: a.fileName || `camera_${Date.now()}.jpg`,
                  type: a.type || 'image/jpeg',
                  fileSize: a.fileSize || 0,
                  width: a.width,
                  height: a.height,
                })),
              });
            } else {
              resolve({ didCancel: true });
            }
          }
        );
      });
    }

    return { didCancel: true, error: 'Camera module is not available.' };
  } catch (err) {
    console.warn('launchCamera error:', err);
    return { didCancel: true, error: err.message };
  }
}

/**
 * Launch image or document library safely.
 * Returns { assets: [{ uri, fileName, type, fileSize }] } or { didCancel: true }
 */
export async function launchImageLibrary(options = {}) {
  const isDocumentPdf =
    options.mediaType === 'document' ||
    options.accept === 'application/pdf' ||
    (typeof options.accept === 'string' && options.accept.includes('pdf'));

  // 1. PDF / Document picking via DocumentPicker
  if (isDocumentPdf) {
    try {
      const [result] = await DocumentPicker.pick({
        type: [types.pdf],
        allowMultiSelection: false,
        copyTo: 'cachesDirectory',
      });

      return {
        assets: [
          {
            uri: result.copyError ? result.uri : (result.fileCopyUri || result.uri),
            fileName: result.name || 'document.pdf',
            type: result.type || 'application/pdf',
            fileSize: result.size || 0,
          },
        ],
      };
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        return { didCancel: true };
      }
      console.warn('DocumentPicker pick error:', err);
      return { didCancel: true, error: err.message };
    }
  }

  // Request runtime gallery permissions gracefully for Android 13+ (READ_MEDIA_IMAGES) or Android 12- (READ_EXTERNAL_STORAGE)
  await requestGalleryPermission();

  // 2. Image picking via react-native-image-picker
  if (RNImagePicker && typeof RNImagePicker.launchImageLibrary === 'function') {
    try {
      return await new Promise((resolve) => {
        RNImagePicker.launchImageLibrary(
          {
            mediaType: 'photo',
            quality: 0.85,
            selectionLimit: 1,
            ...options,
          },
          (response) => {
            if (response.didCancel) {
              resolve({ didCancel: true });
            } else if (response.errorCode || response.errorMessage) {
              resolve({ didCancel: true, error: response.errorMessage || response.errorCode });
            } else if (response.assets && response.assets.length > 0) {
              resolve({
                assets: response.assets.map(a => ({
                  uri: a.uri,
                  fileName: a.fileName || `image_${Date.now()}.jpg`,
                  type: a.type || 'image/jpeg',
                  fileSize: a.fileSize || 0,
                  width: a.width,
                  height: a.height,
                })),
              });
            } else {
              resolve({ didCancel: true });
            }
          }
        );
      });
    } catch (err) {
      console.warn('RNImagePicker launchImageLibrary error, falling back to DocumentPicker:', err);
    }
  }

  // 3. Fallback: Image picking via DocumentPicker
  try {
    const [result] = await DocumentPicker.pick({
      type: [types.images],
      allowMultiSelection: false,
      copyTo: 'cachesDirectory',
    });

    return {
      assets: [
        {
          uri: result.copyError ? result.uri : (result.fileCopyUri || result.uri),
          fileName: result.name || `image_${Date.now()}.jpg`,
          type: result.type || 'image/jpeg',
          fileSize: result.size || 0,
        },
      ],
    };
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      return { didCancel: true };
    }
    return { didCancel: true, error: err.message };
  }
}

export default {
  launchCamera,
  launchImageLibrary,
  requestCameraPermission,
  requestGalleryPermission,
};
