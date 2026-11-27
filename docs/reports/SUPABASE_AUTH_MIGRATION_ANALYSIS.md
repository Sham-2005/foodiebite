# FoodieBite: Supabase Authentication Migration Analysis

**Project**: FoodieBite  
**Target Architecture**: Supabase Authentication & PostgreSQL User Management  
**Current State**: Active Firebase Authentication (Web + Bare React Native Android)  
**Status**: Pre-Migration Audit (Phase 1) — Zero Production Code Modified  

---

## Executive Summary

This document provides a comprehensive audit of FoodieBite's current authentication system across Web and Android platforms. It establishes the architectural baseline required to transition from Firebase Authentication to Supabase Authentication while preserving existing business logic, offline capabilities, admin exclusivity, and zero downtime.

---

## 1. Platform & Environment Architecture

| Platform | Technology Stack | Runtime / Engine | Storage Provider |
| :--- | :--- | :--- | :--- |
| **Web Client** | React 18, React Native Web 0.19.10, Webpack 5 | Modern Browsers | `localStorage` / `sessionStorage` |
| **Android Client** | Bare React Native 0.73.6 (NOT Expo, NOT Capacitor), Kotlin, Gradle 8+ | Hermes / JSC, Android SDK 34 | `@react-native-async-storage/async-storage` (SQLite) |
| **Backend API** | Node.js, Express.js | Node 18+ / 20+ | In-memory `userStore` / JSON Sync |
| **Current Auth** | Firebase JS SDK 10.8.0 (Web) & `@react-native-firebase/auth` 18.8.0 (Android) | Google Identity Platform | Firebase Auth Service |
| **Target Auth** | `@supabase/supabase-js` 2.118.0 (Unified Web & Android) | Supabase GoTrue Service | `localStorage` (Web) / `AsyncStorage` (Android) |

---

## 2. Comprehensive Authentication Audit

### 2.1 Existing Login Implementation (`SignInScreen.js`)
* **File Path**: `frontend/src/screens/SignInScreen.js`
* **Form Inputs**: Email (`email`), Password (`password`), with toggleable visibility.
* **Handlers**:
  - `handleSignIn()`: Validates inputs, calls `apiLogin({ email, password })`, updates `AppContext` via `setUser(data.user)`.
  - `handleGoogleSignIn()`: Calls `apiLoginWithGoogle()`, updates `AppContext`.
  - `handleResetPassword()`: Calls `apiForgotPassword(resetEmail)`.
* **Routing Logic (`routeAfterAuth`)**:
  - Normalizes email: `(userData?.email || rawEmail || '').trim().toLowerCase()`.
  - If email equals `sham111205s@gmail.com`:
    - Web: `window.location.href = '/admin'`
    - Mobile: `navigation.navigate('Admin')`
  - Otherwise:
    - Web: `window.location.href = '/home'`
    - Mobile: `navigation.navigate('Home')`

### 2.2 Existing Registration Implementation (`SignUpScreen.js`)
* **File Path**: `frontend/src/screens/SignUpScreen.js`
* **Form Inputs**: Name (`name`), Email (`email`), Password (`password`), Confirm Password (`confirm`), Gender (`gender`), Age (`age`), Dietary Preferences (`dietary` multi-select).
* **Validation**:
  - Requires all fields to be populated.
  - Verifies `password === confirm`.
  - Enforces minimum password length of 6 characters.
  - Normalizes diet preference (`Vegetarian`, `Non-Vegetarian`, `Vegan`, `Eggetarian`, `Keto`, `Diabetic Friendly`).
* **Handlers**:
  - `handleCreate()`: Calls `apiRegister(...)`.
  - On success, updates `AppContext` and seeds initial preferences.
  - Automatically triggers backend welcome email via Brevo.

### 2.3 Google OAuth Implementation
* **Web Implementation** (`frontend/src/services/googleAuth.web.js`):
  ```javascript
  import { auth, signInWithPopup, GoogleAuthProvider } from './firebase.web';
  export async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }
  ```
* **Android Implementation** (`frontend/src/services/googleAuth.android.js`):
  - Uses native Google Play Services via `@react-native-google-signin/google-signin`.
  - Configured with `webClientId: '433101398092-qd8ui8oog0mbhipv5dra31l55f4klm8u.apps.googleusercontent.com'`.
  - Retrieves native `idToken` from Google.
  - Creates credential: `GoogleAuthProvider.credential(idToken)`.
  - Signs in via `@react-native-firebase/auth`: `signInWithCredential(auth, credential)`.

### 2.4 Logout Implementation
* **File Path**: `frontend/src/context/AppContext.js` & `frontend/src/services/api.js`
* **Function**: `logout()`
* **Cleanup Lifecycle**:
  1. Calls backend `/api/logout` (if reachable).
  2. Calls Firebase `signOut(auth)`.
  3. Purges `localStorage` items:
     - `nb_token` (JWT token)
     - `nb_active_session` (Offline user snapshot)
     - `nb_mock_active`
     - `foodiebite_admin_session`
  4. Purges `sessionStorage` items:
     - `foodiebite_admin_session`
     - `foodiebite_redirect_after_login`
  5. Clears in-memory React state: `userState(null)`, `favorites([])`, `savedFoodObjects([])`.

### 2.5 Authentication Context & State Rehydration (`AppContext.js`)
* **File Path**: `frontend/src/context/AppContext.js`
* **Two-Stage Rehydration Lifecycle**:
  1. **Synchronous Offline Rehydration (First Paint)**:
     - Immediately reads `getSession()` from `localStorage`.
     - Populates `userState` with `uid`, `email`, `name`, `age`, `gender`, `profileCompleted`.
     - Prevents flash of unauthenticated content or incorrect redirect to `/complete-profile`.
  2. **Asynchronous Firebase Rehydration (`onAuthStateChanged`)**:
     - Listens to Firebase auth state.
     - On valid user: calls `fbUser.getIdToken()`, sets API token, calls `apiGetMe()`, reconciles with backend `/user/sync`.
     - On null user: clears tokens and resets user state.

### 2.6 Protected Routes & Navigation Stacks (`App.js` & `ProtectedAdminRoute.js`)
* **File Path**: `frontend/src/App.js` & `frontend/src/components/ProtectedAdminRoute.js`
* **Stack Navigator Gating**:
  - Gated by `!user` -> Renders Public Stack (`Splash`, `SignIn`, `SignUp`, `Onboarding`, `NutritionScanner`).
  - Gated by `isAdminUser` -> Renders Admin Stack (`Admin`, `SignIn`).
  - Gated by `!hasCompletedProfile` -> Renders `CompleteProfileScreen`.
  - Signed-in Regular User -> Renders App Stack (`Home`, `Search`, `FoodDetail`, `Profile`, etc.).
* **Admin Route Protection (`ProtectedAdminRoute.js`)**:
  - Enforces `AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com'`.
  - Checks `sessionStorage` and `localStorage` for `foodiebite_admin_session`.
  - Unauthenticated users: Redirected to `SignIn`.
  - Authenticated regular users: Shown an explicit "Access Denied" screen with return-to-home button.
  - Authorized admin: Renders `AdminDashboardScreen` wrapped in `React.Suspense`.

### 2.7 Backend Authentication Middleware (`backend/src/middleware/authMiddleware.js`)
* **Header**: `Authorization: Bearer <token>`
* **Multi-Tier Token Verification**:
  1. Checks mock dev tokens (`mock_...`).
  2. Verifies Firebase ID Token using Firebase Admin SDK: `adminApp.auth().verifyIdToken(token)`.
  3. Verifies account status: Queries Firestore `users/{uid}` to ensure `disabled !== true` and `accountStatus !== 'disabled'`.
  4. Enforces Admin Authorization: Only `sham111205s@gmail.com` receives `req.user.role = 'admin'`. All other accounts default to `role = 'user'`.

---

## 3. Dependency Inventory: Every Firebase Auth File & Usage

| File Location | Firebase Import / Usage | Purpose in Current Architecture |
| :--- | :--- | :--- |
| `frontend/src/services/firebase.web.js` | `getAuth`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `sendPasswordResetEmail`, `signInWithPopup`, `GoogleAuthProvider`, `updatePassword`, `updateProfile` | Core Firebase Web Auth SDK exports. |
| `frontend/src/services/firebase.android.js` | `@react-native-firebase/app`, `@react-native-firebase/auth` | Core Firebase Android Native SDK exports. |
| `frontend/src/services/firebase.js` | Re-exports all web/android auth utilities. | Unified import interface for client components. |
| `frontend/src/context/AppContext.js` | `onAuthStateChanged`, `auth`, `isFirebaseConfigured` | Auth state listener, token extraction, and session sync. |
| `frontend/src/services/api.js` | `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `GoogleAuthProvider`, `signInWithPopup`, `signInWithCredential`, `sendPasswordResetEmail`, `fbUpdatePassword`, `fbUpdateProfile` | Authentication API operations and Firestore user document CRUD. |
| `frontend/src/services/googleAuth.web.js` | `signInWithPopup`, `GoogleAuthProvider` | Browser-based Google popup login. |
| `frontend/src/services/googleAuth.android.js` | `@react-native-google-signin/google-signin`, `GoogleAuthProvider`, `signInWithCredential` | Native Android Play Services Google Sign-In. |
| `backend/src/config/firebase.js` | `firebase-admin/auth`, `getAuth` | Server-side Firebase Admin SDK initialization. |
| `backend/src/middleware/authMiddleware.js` | `adminApp.auth().verifyIdToken(token)` | Server-side token verification on protected API endpoints. |

---

## 4. Current User Profile Data Structure

Stored in Firestore collection `users/{uid}` and mirrored in local offline storage:

```typescript
interface FoodieBiteUserProfile {
  id: string;                      // Firebase UID (string)
  uid: string;                     // Duplicate for legacy compatibility
  name: string;                    // User full display name
  email: string;                   // Lowercase trimmed email
  photoURL?: string;               // Avatar URL
  authProvider: 'password' | 'google.com';
  accountStatus: 'active' | 'disabled' | 'suspended';
  disabled: boolean;               // Boolean lock flag
  role: 'user' | 'admin';          // 'admin' ONLY for sham111205s@gmail.com
  age?: number | string;           // Physical profile age
  gender?: string;                 // 'male' | 'female' | 'other' | 'prefer_not_to_say'
  dietType: string;                // Primary diet (e.g. 'Vegetarian')
  welcomeEmailSent: boolean;
  notificationSettings: {
    dailySuggestions: boolean;
    loginAlerts: boolean;
    marketingEmails: boolean;
  };
  preferences: {
    dietType: string;
    spiceLevel: string;
    cuisines: string[];
    healthGoals: string[];
    allergies: string[];
    country: string;
    minGrade: string;
    maxCalories: number | null;
    minProtein: number | null;
  };
  favoriteFoods: string[];         // List of favorite food IDs
  searchHistory: string[];
  createdAt: string;               // ISO 8601 Timestamp
  lastSignInTime: string;          // ISO 8601 Timestamp
  lastLoginAt: string;             // ISO 8601 Timestamp
}
```

---

## 5. Architectural Differences: Firebase vs Supabase

| Capability | Firebase Authentication | Supabase Authentication (GoTrue) |
| :--- | :--- | :--- |
| **User Identity Storage** | Proprietary Google Identity Directory | `auth.users` in PostgreSQL schema |
| **Profile Metadata** | Custom claims or Firestore document | Linked `public.profiles` table via foreign key `id` |
| **Token Format** | Firebase JWT (expires in 1 hr) | Standard OIDC/JWT with access & refresh tokens |
| **Session Persistence (Web)** | `indexedDB` / `localStorage` | `window.localStorage` (configured via client) |
| **Session Persistence (Android)** | Native Android KeyStore (via Play Services) | `@react-native-async-storage/async-storage` |
| **Admin Enforcement** | Hardcoded client/backend check + claims | Database RLS + `public.is_admin()` + Security Definer triggers |
| **User Creation Hook** | Cloud Functions (`functions.auth.user().onCreate`) | Native PostgreSQL trigger (`AFTER INSERT ON auth.users`) |
| **Activity Audit Trail** | Google Cloud Audit Logs (Console only) | Dedicated PostgreSQL table `public.auth_activity_logs` |
| **Google Sign-In (Web)** | Popup / Redirect (`signInWithPopup`) | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| **Google Sign-In (Android)** | `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` | `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })` |

---

## 6. Migration Risk Analysis & Mitigation

1. **Risk: Breaking Existing Logged-in Users During Development**
   - *Mitigation*: Do not replace Firebase Auth yet. Implement a dual-client abstraction layer (`authService.js`) that allows Supabase to run in shadow/opt-in mode alongside Firebase.
2. **Risk: Profile Privilege Escalation**
   - *Mitigation*: The trigger `prevent_profile_privilege_escalation` on `public.profiles` prevents non-admin users from altering `role`, `disabled`, or `account_status`, even via direct REST API calls.
3. **Risk: Android OAuth Browser Redirect Failures**
   - *Mitigation*: Avoid launching external browser tabs on Android. Retain `@react-native-google-signin/google-signin` to obtain native Google `idToken`, and pass it to `supabase.auth.signInWithIdToken()`.
4. **Risk: Session Loss on Page Refresh**
   - *Mitigation*: Enable `persistSession: true` and `autoRefreshToken: true` in `supabaseClient.js`, mapped to `AsyncStorage` on Android and `localStorage` on Web.

