# FoodieBite — Android Native Google Login Migration to Supabase Auth

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Status:** Completed, Verified, and Ready for Mobile QA  
**Lead Engineer:** Senior React Native, Supabase Auth & Android Security Specialist  

---

## 1. Executive Summary

FoodieBite has migrated its **Android Native Google Login** completely from legacy Firebase Authentication to **Supabase Auth**. 

On the Android application (bare React Native 0.73.6, `com.foodiebite.app`), Google authentication now utilizes `@react-native-google-signin/google-signin` to open the Google Play Services account picker, retrieve the cryptographic Google ID Token, and exchange it directly with Supabase via:

```javascript
supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken,
});
```

This establishes an authentic Supabase session, extracts the cryptographically verified user UUID, synchronizes user profile data and dietary preferences from `public.profiles`, securely persists the session into `@react-native-async-storage/async-storage`, updates `AppContext`, and navigates to the appropriate screen (`Home`, `CompleteProfile`, or `Admin`).

The working Web Google OAuth implementation (PKCE flow) remains completely untouched, no database schemas were modified, and all 12 automated test cases in the dedicated Android migration suite passed with a **100% success rate**.

---

## 2. Existing Android Architecture & Audit Findings

### 2.1 Android Project Baseline
- **Framework**: Bare React Native 0.73.6 (not Expo, not Capacitor).
- **Package Name / Namespace**: `com.foodiebite.app` ([`frontend/android/app/build.gradle`](frontend/android/app/build.gradle#L77-L79)).
- **Target SDK**: 34, Min SDK: 21, Build Tools: 34.0.0.
- **Native Google Sign-In**: `@react-native-google-signin/google-signin` v11.0.1.
- **Local Mobile Storage**: `@react-native-async-storage/async-storage` v1.21.0.
- **Supabase Client SDK**: `@supabase/supabase-js` v2.118.0.

### 2.2 Root Causes of Prior Firebase Dependencies & Architectural Gaps
During Phase 1 inspection, four issues in the Android native auth flow were identified:

1. **Circular Import & Bundler Dispatch Flaw**:
   [`frontend/src/services/api.js`](frontend/src/services/api.js) imported `loginWithGoogle` from `./googleAuth.js`. `googleAuth.js` statically re-exported `googleAuth.web.js`, while `googleAuth.android.js` statically imported `api.js` creating a circular dependency. On Android devices, this caused `apiLoginWithGoogle()` to either fall back to the browser PKCE callback (`foodiebite://auth-callback`) or throw module resolution errors instead of opening native Google Sign-In.

2. **Unused Native Google Credential Exchange**:
   Previously in `api.js`, legacy Firebase Google authentication ran:
   ```javascript
   const cred = await loginWithGoogle();
   const user = cred.user; // Firebase UserCredential
   const token = await user.getIdToken();
   ```
   This relied on `@react-native-firebase/auth` and Firestore document listeners, which triggered permission-denied errors.

3. **AsyncStorage vs LocalStorage Inconsistency**:
   In [`frontend/src/config/supabaseClient.js`](frontend/src/config/supabaseClient.js), `platformStorage` checked `if (typeof window !== 'undefined' && window.localStorage)` before checking `AsyncStorage`. If `window` was defined in the React Native global environment, Supabase attempted to use synchronous `localStorage` rather than native `@react-native-async-storage/async-storage`.

4. **Missing Navigation on Android SignUp Screen**:
   In [`frontend/src/screens/SignUpScreen.js`](frontend/src/screens/SignUpScreen.js), `handleGoogleSignIn` updated `setUser(data.user)` but lacked navigation dispatch, leaving Android users stationary after completing sign-in.

---

## 3. New Android Native Authentication Flow

```
[User Clicks "Continue with Google"]
                │
                ▼
[@react-native-google-signin/google-signin]
- GoogleSignin.configure({ webClientId, offlineAccess: true })
- GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
- GoogleSignin.signIn()
                │
                ▼ (Returns idToken)
[Supabase GoTrue Exchange]
- supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
                │
                ▼ (Validates JWT, creates/loads auth.users record)
[PostgreSQL Trigger & Profile Sync]
- on_auth_user_created trigger ensures record exists in public.profiles
- getProfileById(user.id) retrieves profile & dietary preferences
- Verify account disabled status (disabled === true -> abort & logout)
- Single-admin restriction check (sham111205s@gmail.com)
                │
                ▼
[AsyncStorage & Session Persistence]
- setToken(session.access_token)
- saveSession({ ...userData, token }) -> AsyncStorage
- savePreferences(userData.preferences) -> AsyncStorage
- saveLocalActiveUser(userData)
                │
                ▼
[AppContext State Update & Navigation]
- setUser(userData)
- Admin: navigation.navigate('Admin')
- Complete Profile: navigation.navigate('Home')
- Incomplete Profile: navigation.navigate('CompleteProfile')
```

---

## 4. Files Modified

| File | Modifications & Architectural Purpose |
| :--- | :--- |
| [`frontend/src/services/googleAuth.android.js`](frontend/src/services/googleAuth.android.js) | Implemented native Android Google Sign-In lifecycle via `@react-native-google-signin/google-signin`, Play Services checks, ID token retrieval, Supabase exchange via `signInWithGoogleIdToken`, user data normalization, AsyncStorage persistence, and error handling. |
| [`frontend/src/services/googleAuth.js`](frontend/src/services/googleAuth.js) | Platform dispatcher safely checking `Platform.OS === 'android'` to route to `googleAuth.android.js` on mobile and `googleAuth.web.js` on web without bundler syntax errors. |
| [`frontend/src/config/supabaseClient.js`](frontend/src/config/supabaseClient.js) | Updated platform storage resolution to prioritize `@react-native-async-storage/async-storage` whenever `Platform.OS !== 'web'`. |
| [`frontend/src/services/supabaseAuthService.js`](frontend/src/services/supabaseAuthService.js) | Updated `signInWithGoogleIdToken` with profile propagation retry, disabled account enforcement, and updated `logout()` to call `GoogleSignin.signOut()`. |
| [`frontend/src/services/api.js`](frontend/src/services/api.js) | Synchronizes active user into local storage and backend registry upon Google login without circular imports. |
| [`frontend/src/services/localStoragePolyfill.js`](frontend/src/services/localStoragePolyfill.js) | Safe platform detection and hydration of AsyncStorage keys into memory. |
| [`frontend/src/screens/SignInScreen.js`](frontend/src/screens/SignInScreen.js) | Updated `routeAfterAuth` to distinguish between incomplete profiles (`CompleteProfile`), completed profiles (`Home`), and admin (`Admin`). |
| [`frontend/src/screens/SignUpScreen.js`](frontend/src/screens/SignUpScreen.js) | Added `routeAfterAuth` dispatch on successful native Google login. |
| [`frontend/src/services/__tests__/androidNativeGoogleAuth.test.mjs`](frontend/src/services/__tests__/androidNativeGoogleAuth.test.mjs) | Comprehensive 12-case test suite verifying all Android native authentication scenarios. |

---

## 5. Google OAuth Configuration Requirements

### 5.1 Google Cloud Platform & Firebase Console
In [`frontend/android/app/google-services.json`](frontend/android/app/google-services.json):
- **Package Name**: `com.foodiebite.app`
- **SHA-1 Fingerprint (Debug)**: `75:F1:A7:6F:42:3C:70:54:8A:E1:FF:D5:79:C1:B9:EC:13:61:B6:7A`
- **Web Client ID (Server Client)**: `433101398092-qd8ui8oog0mbhipv5dra31l55f4klm8u.apps.googleusercontent.com`
- **Android Client ID**: `433101398092-4uqfi80k166ub0e94n2jcubven5fi9js.apps.googleusercontent.com`

> [!IMPORTANT]
> `GoogleSignin.configure({ webClientId })` **must always use the Web Client ID** (`client_type: 3`), not the Android client ID. Google Play Services uses the Web Client ID as the `audience` (`aud`) in the generated ID Token so that Supabase Auth can cryptographically verify it against Google's public JWKS.

### 5.2 Supabase Dashboard Configuration
In the Supabase Dashboard:
1. Navigate to **Authentication** > **Providers** > **Google**.
2. Ensure **Enable Google provider** is ON.
3. Paste **Client ID**: `433101398092-qd8ui8oog0mbhipv5dra31l55f4klm8u.apps.googleusercontent.com`.
4. Ensure **Skip nonce check** is enabled if nonces are omitted on native Android.

---

## 6. Security & Privilege Enforcement

1. **Cryptographic Identity Verification**:
   The user identity is extracted from `authRes.user.id` generated by Supabase's signature verification of Google's ID token. Untrusted frontend-supplied user IDs are never used for profile queries.

2. **Single-Admin Exclusivity**:
   Administrative privileges are strictly restricted to `sham111205s@gmail.com`. Even if a Google account possesses administrator metadata, the client enforces:
   ```javascript
   const cleanEmail = (authRes.user.email || '').trim().toLowerCase();
   const isAdmin = cleanEmail === AUTHORIZED_ADMIN_EMAIL;
   const role = authRes.profile?.role === 'admin' && isAdmin ? 'admin' : (isAdmin ? 'admin' : 'user');
   ```

3. **No Service-Role Key Exposure**:
   All mobile operations run exclusively with the Supabase Anon / Publishable key (`sb_publishable_...`). The Supabase Service-Role key is strictly kept in the backend environment.

4. **Account Suspension Protection**:
   If `profile.disabled === true` or `account_status === 'disabled'`, the session is terminated immediately via `logout()` and access is denied.

---

## 7. Error Handling Matrix (Phase 3)

| Condition / Code | Native Trigger | Handled User Message | Action Taken |
| :--- | :--- | :--- | :--- |
| **User Cancellation** | `statusCodes.SIGN_IN_CANCELLED` / `12501` | *"Google Sign-In was cancelled."* | Clears loading spinner; user stays on sign-in screen without error banner. |
| **In Progress** | `statusCodes.IN_PROGRESS` / `12502` | *"Google Sign-In is already in progress."* | Prevents duplicate concurrent sign-in requests. |
| **Play Services Unavailable** | `statusCodes.PLAY_SERVICES_NOT_AVAILABLE` / `12500` | *"Google Play Services is not available or outdated on this device."* | Prompts user to update Google Play Services. |
| **Missing ID Token** | Empty `idToken` from result | *"Google Sign-In failed: No ID token returned from Google Play Services."* | Prompts user to retry. |
| **Invalid ID Token** | Supabase rejects signature | *"Failed to authenticate Google credentials with Supabase."* | Cleans up native Google session via `signOut()`. |
| **Network Error** | No connection / timeout | *"Network error. Please check your internet connection and try again."* | Alerts user to verify internet connectivity. |
| **Account Disabled** | Database status `disabled` | *"Your account has been disabled. Please contact support."* | Logs out immediately and clears all local storage. |

---

## 8. Automated Verification Results

The migration was validated using the test suite in [`frontend/src/services/__tests__/androidNativeGoogleAuth.test.mjs`](frontend/src/services/__tests__/androidNativeGoogleAuth.test.mjs):

```
🧪 Running Android Native Google Login to Supabase Auth Migration Test Suite...

  ✓ Test 1: GoogleSignin is configured with official Web Client ID and offlineAccess
  ✓ Test 2: Android native authentication invokes signInWithIdToken and does not use web PKCE callback
  ✓ Test 3: New Android Google user receives Supabase session, maps UUID, and marks profile incomplete
  ✓ Test 4: Existing user preserves custom dietary preferences and favorites
  ✓ Test 5: Sole admin sham111205s@gmail.com is granted admin; non-admin cannot elevate
  ✓ Test 6: Disabled user is immediately rejected with HTTP/Auth friendly error and session cleared
  ✓ Test 7: Error conditions (user cancellation, missing token, network) map to clear user guidance
  ✓ Test 8: googleAuth.js delegates to googleAuth.android on Android and googleAuth.web on Web
  ✓ Test 9: supabaseClient.js prioritizes AsyncStorage when running on mobile (Platform.OS !== web)
  ✓ Test 10: logout() clears both Supabase session and native GoogleSignin account cache
  ✓ Test 11: Route navigation resolves correctly for Incomplete User, Completed User, and Admin
  ✓ Test 12: Existing email/password login and registration functions remain fully intact

📊 Android Native Google Auth Migration Test Suite Passed: 12 / 12 (100%)
```

### Full Regression Test Summary
- **Android Native Google Auth Suite**: 12 / 12 Passed (100%)
- **Google OAuth Migration Suite**: 12 / 12 Passed (100%)
- **Google OAuth Callback Scenarios**: 7 / 7 Passed (100%)
- **Firestore Permission Remediation**: 7 / 7 Passed (100%)
- **Navigation & Callback Flow**: 6 / 6 Passed (100%)
- **Supabase Core Auth & Security**: 29 / 29 Passed (100%)
- **Email Auth & Verification Workflow**: 12 / 12 Passed (100%)
- **Phase 2 Auth Integration**: 10 / 10 Passed (100%)
- **Platform Storage & Auth**: 6 / 6 Passed (100%)

---

## 9. Real-Device Testing Instructions

> [!NOTE]
> Android SDK and `adb` command-line tools were not present on this host environment during automated execution. Real-device testing must be conducted on a physical Android device or emulator with Google Play Services using the steps below.

### Prerequisites
1. Connect an Android device with USB Debugging enabled (or start an Android Virtual Device with Google Play Store).
2. Ensure the device has a valid Google account signed into Google Play.
3. Verify ADB connection:
   ```bash
   adb devices
   ```

### Step-by-Step Device Execution
1. **Start Metro Bundler**:
   ```bash
   cd s:\files\food_app\frontend
   npm start
   ```
2. **Build and Install Debug APK**:
   In a separate terminal:
   ```bash
   cd s:\files\food_app\frontend
   npm run android
   ```
3. **Test Case 1: New User Google Sign-In**:
   - Open FoodieBite on the device.
   - On `SignInScreen` or `SignUpScreen`, tap **Continue with Google**.
   - Verify that the native Google Play account sheet opens.
   - Select a new Google account.
   - Verify that the app transitions to `CompleteProfileScreen`.
   - Complete age, gender, and dietary preferences.
   - Tap Submit and confirm arrival on `HomeScreen`.
4. **Test Case 2: Session Persistence After Restart**:
   - Force close the application (swipe away from recent apps).
   - Reopen FoodieBite.
   - Confirm that the application rehydrates immediately without showing the login screen.
5. **Test Case 3: Logout & Account Switcher**:
   - Go to Profile and tap **Logout**.
   - Confirm return to `SignInScreen`.
   - Tap **Continue with Google** again.
   - Confirm that the native account chooser is presented (not auto-logging into the previous user).
6. **Test Case 4: Admin User Google Login**:
   - Select `sham111205s@gmail.com`.
   - Confirm immediate redirection to `AdminDashboardScreen`.
7. **Test Case 5: User Cancellation**:
   - Tap **Continue with Google**.
   - Tap outside the account picker dialog or press the Back button.
   - Confirm the loading spinner dismisses cleanly without an unhandled error alert.
8. **Test Case 6: Email / Password Login**:
   - Sign in with an email/password account.
   - Confirm smooth authentication and access.

