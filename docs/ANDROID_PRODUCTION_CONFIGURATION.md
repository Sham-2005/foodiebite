# FoodieBite — Android Production Configuration Guide

## 1. Application Identity

- **Platform**: React Native 0.73.6
- **Package Name**: `com.foodiebite.app`
- **Application Class**: `com.foodiebite.app.MainApplication`
- **Main Activity**: `com.foodiebite.app.MainActivity`
- **Minimum SDK**: 24 (Android 7.0 Nougat)
- **Target SDK / Compile SDK**: 34 (Android 14)
- **NDK Version**: `25.1.8937393`

---

## 2. Production Backend Wiring

Android network calls are managed centrally by [`frontend/src/config/apiConfig.js`](file:///s:/files/food_app/frontend/src/config/apiConfig.js):

- **Production API URL**: `https://foodiebite-backend.onrender.com/api`
- **Asset/Upload Base URL**: `https://foodiebite-backend.onrender.com`
- **Enforcement**: In production APK releases (`!__DEV__`), the backend URL strictly defaults to `https://foodiebite-backend.onrender.com`, completely bypassing any emulator-local IP addresses (`10.0.2.2`).

---

## 3. Permissions & Network Security

Configured in [`frontend/android/app/src/main/AndroidManifest.xml`](file:///s:/files/food_app/frontend/android/app/src/main/AndroidManifest.xml):

### Active Permissions:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED" />
```

### Deep-Link Intent Filter (OAuth & Redirects):
```xml
<activity
  android:name=".MainActivity"
  ...
  android:exported="true">
  <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>
  <!-- Deep Link Handler for foodiebite:// -->
  <intent-filter>
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:scheme="foodiebite" />
  </intent-filter>
</activity>
```

---

## 4. Build & Bundling Commands

### A. Regenerate React Native Offline Bundle
```bash
cd frontend
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

### B. Compile Debug APK
```bash
cd frontend/android
./gradlew assembleDebug
# Output binary: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### C. Compile Signed Release APK
```bash
cd frontend/android
./gradlew assembleRelease
# Output binary: frontend/android/app/build/outputs/apk/release/app-release.apk
```
