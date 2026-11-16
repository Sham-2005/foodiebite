# FoodieBite — Firestore Permission-Denied Remediation & Deprecation Report

**Document Version:** 1.0.0  
**Date:** November 12, 2026  
**Status:** Remediated, Verified, and Ready for Production  
**Lead Engineer:** Senior React, Supabase Auth & Security Specialist  

---

## 1. Executive Summary

Following the Google OAuth migration to Supabase Authentication, users encountered an uncaught runtime error in the browser console upon landing on the Home page:

```
@firebase/firestore: Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
```

The stack traces referenced:
- `App.js`
- `AppContext.js`
- `BottomNav.js`
- `AppLayout.js`
- `HomeScreen.js`

Simultaneously, React Native Web emitted deprecation warnings regarding:
- `accessibilityRole` (deprecated in favor of `role`)
- `accessibilityLabel` (deprecated in favor of `aria-label`)
- `pointerEvents` (deprecated as prop in favor of `style.pointerEvents`)

This investigation traced the exact origin of the Firestore listener, remediated the authentication mismatch without weakening Firestore security rules or disabling Firebase globally, transitioned nutritional deficiency lookups to verified Supabase sessions, added defensive error interception to the Firebase web client, and modernized all deprecated React Native Web attributes across the codebase.

All automated verification tests passed **100% (7/7)** in the dedicated remediation suite, with **0 regressions** across all existing authentication and backend test suites.

---

## 2. Root Cause Analysis

### 2.1 The Originating Snapshot Listener
The error originated directly in [`frontend/src/screens/HomeScreen.js`](frontend/src/screens/HomeScreen.js) inside the active deficiencies hook (previously lines 78–96):

```javascript
// Previous vulnerable implementation in HomeScreen.js
useEffect(() => {
  if (isFirebaseConfigured) {
    const targetUid = user?.uid || user?.id || auth?.currentUser?.uid;
    if (!targetUid) return;
    const path = `users/${targetUid}/deficiencies`;
    const q = query(collection(db, path), where('resolved', '==', false));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      setDeficiencies(list);
    });
    return () => unsubscribe();
  } else { ... }
}, [user?.uid, user?.id]);
```

### 2.2 Why the Permission-Denied Error Occurred
1. **Authentication Provider Transition**:
   - The user authenticated using Supabase Google OAuth.
   - The active session exists in Supabase Auth (`supabaseClient.auth`), which stores a PostgreSQL UUID in `user.id` / `user.uid`.
   - Firebase Auth (`auth.currentUser`) is **`null`** because Firebase Authentication is no longer invoked for the session.

2. **Security Rule Enforcement**:
   In [`firestore.rules`](firestore.rules) (lines 49–52):
   ```
   match /users/{userId}/deficiencies/{defId} {
     allow read: if isOwner(userId) || isAdmin();
     allow write: if false; // backend-only writes
   }
   ```
   where `isOwner(userId)` is defined as:
   ```
   function isOwner(userId) {
     return request.auth != null && request.auth.uid == userId;
   }
   ```
   Because the user is authenticated in Supabase but not in Firebase Auth, `request.auth` evaluates to `null`. Firestore strictly denied access.

3. **Missing Snapshot Error Handler**:
   In the Firebase JS SDK (`@firebase/firestore`), `onSnapshot(query, onNext)` without an `onError` parameter raises an **uncaught exception**:
   `@firebase/firestore: Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]`.
   This uncaught error bubbled up the React component hierarchy:
   `HomeScreen` ➔ `AppLayout` ➔ `BottomNav` ➔ `AppContent` ➔ `AppContext`.

4. **Secondary Firestore Leak in `medicalReportsService.js`**:
   In [`frontend/src/services/medicalReportsService.js`](frontend/src/services/medicalReportsService.js) (line 355), `subscribeMedicalReports` checked `if (isFirebaseConfigured && db)`, attempting to subscribe to `medicalReports where userId == userId` regardless of whether `auth.currentUser` was signed in, triggering unnecessary permission warnings.

---

## 3. Feature Migration Status & Supabase Alignment

### 3.1 Feature Audit: Nutritional Deficiencies
In FoodieBite, nutritional deficiencies track whether a user's 14-day average intake falls below 65% of their Recommended Daily Allowance (RDA) for key micronutrients (e.g., Iron, Vitamin D, Vitamin B12).

- **Legacy Cloud Firestore Path**: `/users/{userId}/deficiencies/{defId}`
- **Supabase Core Schema Target**: [`supabase/migrations/20261102000001_core_schema.sql`](supabase/migrations/20261102000001_core_schema.sql) Table 6:
  ```sql
  CREATE TABLE IF NOT EXISTS public.user_deficiencies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      nutrient_name TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
      detected_level TEXT,
      target_level TEXT,
      recommendations JSONB DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved')),
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
  );
  ```
- **Current Remote Supabase State**: Table `user_deficiencies` is declared in the migration suite but not yet applied to the remote schema cache. Direct queries to an unmigrated table must fail gracefully with null/empty results and never crash the application.

---

## 4. Remediation Implementation Details

### 4.1 Verified Supabase Identity & Safe Deficiencies Query in `HomeScreen.js`
In [`frontend/src/screens/HomeScreen.js`](frontend/src/screens/HomeScreen.js):
- Import `getSupabaseClient, isSupabaseConfigured` from `../config/supabaseClient`.
- Verify the active session via `client.auth.getSession()` to obtain the trusted `verifiedUserId` directly from the cryptographic session token, rather than trusting unverified frontend props.
- If Supabase is configured: query `user_deficiencies` with `status = 'active'`. If the table is empty or pending migration, handle gracefully without error.
- If Firebase is configured: **strictly verify that `auth?.currentUser` exists and matches `user.uid`** before opening any Firestore listener.
- Provide a dedicated `onError` callback to `onSnapshot` so that network or rule changes cannot generate uncaught exceptions.
- Ensure proper cleanup via `unsubscribeFs()` on component unmount and session state changes.

```javascript
// Remediated deficiency loader in HomeScreen.js
useEffect(() => {
  let isMounted = true;
  let unsubscribeFs = null;

  async function loadDeficiencies() {
    if (isSupabaseConfigured) {
      try {
        const client = getSupabaseClient();
        if (!client) {
          if (isMounted) setDeficiencies([]);
          return;
        }
        // Ensure authenticated user UUID comes strictly from verified Supabase session
        const { data: sessionData } = await client.auth.getSession();
        const verifiedUserId = sessionData?.session?.user?.id;
        if (!verifiedUserId) {
          if (isMounted) setDeficiencies([]);
          return;
        }

        const { data, error } = await client
          .from('user_deficiencies')
          .select('*')
          .eq('user_id', verifiedUserId)
          .eq('status', 'active');

        if (isMounted) {
          if (!error && Array.isArray(data)) {
            const mapped = data.map(d => ({
              id: d.id,
              nutrient: d.nutrient_name || d.nutrient,
              averageIntake: d.detected_level || d.averageIntake,
              requiredRda: d.target_level || d.requiredRda,
              severity: (d.severity || 'moderate').toUpperCase(),
              resolved: d.status === 'resolved' || d.resolved === true
            }));
            setDeficiencies(mapped);
          } else {
            setDeficiencies([]);
          }
        }
      } catch (err) {
        console.warn('Supabase deficiencies load notice:', err.message);
        if (isMounted) setDeficiencies([]);
      }
    } else if (isFirebaseConfigured && auth?.currentUser && (user?.uid === auth.currentUser.uid || !user?.uid)) {
      try {
        const targetUid = auth.currentUser.uid;
        const path = `users/${targetUid}/deficiencies`;
        const q = query(collection(db, path), where('resolved', '==', false));
        unsubscribeFs = onSnapshot(
          q,
          (snap) => {
            if (!isMounted) return;
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            setDeficiencies(list);
          },
          (err) => {
            console.warn('Firestore deficiencies onSnapshot notice:', err.message);
            if (isMounted) setDeficiencies([]);
          }
        );
      } catch (err) {
        console.warn('Firestore subscription setup notice:', err.message);
        if (isMounted) setDeficiencies([]);
      }
    } else {
      if (isMounted) setDeficiencies([]);
    }
  }

  loadDeficiencies();

  return () => {
    isMounted = false;
    if (typeof unsubscribeFs === 'function') {
      unsubscribeFs();
    }
  };
}, [user?.uid, user?.id]);
```

### 4.2 Safe `onSnapshot` Wrapper in `firebase.web.js`
In [`frontend/src/services/firebase.web.js`](frontend/src/services/firebase.web.js):
To provide defense-in-depth across any remaining or legacy Firestore listeners throughout the web application, `onSnapshot` was wrapped to guarantee that even if a caller omits the `onError` parameter, a default non-fatal logger is supplied:

```javascript
// Safe onSnapshot wrapper that prevents uncaught listener errors when onError is omitted
export function onSnapshot(ref, onNext, onError) {
  return webOnSnapshot(
    ref,
    (snapshot) => {
      if (typeof onNext === 'function') onNext(snapshot);
    },
    (err) => {
      if (typeof onError === 'function') {
        onError(err);
      } else {
        console.warn('Firestore onSnapshot listener notice:', err?.message || err);
      }
    }
  );
}
```

### 4.3 Medical Reports & ChatScreen Safeguards
1. In [`frontend/src/services/medicalReportsService.js`](frontend/src/services/medicalReportsService.js):
   Updated line 355 to verify `if (isFirebaseConfigured && db && auth?.currentUser && auth.currentUser.uid === userId)` before attaching the listener. When using Supabase Auth, reports load exclusively via `apiGetMedicalReports()` from PostgreSQL.
2. In [`frontend/src/screens/ChatScreen.js`](frontend/src/screens/ChatScreen.js):
   Added `(err) => console.warn('Firestore ChatScreen onSnapshot notice:', err?.message || err)` to line 58.

---

## 5. React Native Web Deprecated Properties Remediation

In React Native Web (v0.19+), legacy accessibility props generate runtime console warnings. All occurrences across the repository were replaced with modern, standard ARIA and web attributes without affecting visual styling or behavior:

| Deprecated Property | Standard Replacement | Files Updated | Purpose |
| :--- | :--- | :--- | :--- |
| `accessibilityRole="button"` | `role="button"` | `BottomNav.js`<br>`AppLayout.js`<br>`ProtectedAdminRoute.js`<br>`AdminDashboardScreen.js`<br>`NutritionScannerScreen.js` | Semantic button role for screen readers |
| `accessibilityLabel="..."` | `aria-label="..."` | `BottomNav.js`<br>`AppLayout.js`<br>`DevSupabaseDemoModal.js`<br>`ProtectedAdminRoute.js`<br>`AdminDashboardScreen.js`<br>`NutritionScannerScreen.js` | Descriptive accessible name for interactive elements |
| `pointerEvents="none"` (as prop) | `style={{ pointerEvents: 'none' }}` | Inspected (no active JSX prop occurrences remained; verified CSS `cursor: pointer` is compliant) | Touch / click event interception |

### Files Modified for Deprecation Cleanup:
- [`frontend/src/components/BottomNav.js`](frontend/src/components/BottomNav.js#L40-L45)
- [`frontend/src/components/AppLayout.js`](frontend/src/components/AppLayout.js#L253-L256)
- [`frontend/src/components/DevSupabaseDemoModal.js`](frontend/src/components/DevSupabaseDemoModal.js#L88-L92)
- [`frontend/src/components/ProtectedAdminRoute.js`](frontend/src/components/ProtectedAdminRoute.js#L76-L82)
- [`frontend/src/screens/AdminDashboardScreen.js`](frontend/src/screens/AdminDashboardScreen.js#L814-L820)
- [`frontend/src/screens/NutritionScannerScreen.js`](frontend/src/screens/NutritionScannerScreen.js#L445-L455)

---

## 6. Automated Verification Results

### 6.1 Dedicated Remediation Test Suite
Executed via `node frontend/src/services/__tests__/firestorePermissionRemediation.test.mjs`:

```
🧪 Running FoodieBite Firestore Permission-Denied Remediation & Deprecation Test Suite...

  ✓ Test 1: firebase.web.js onSnapshot wrapper provides default error handling when onError is omitted
  ✓ Test 2: Deficiencies loader retrieves verified user ID from Supabase session, not trusting arbitrary input
  ✓ Test 3: Unauthenticated Firebase user does not trigger Firestore onSnapshot
  ✓ Test 4: Medical reports real-time sync checks auth.currentUser.uid before Firestore query
  ✓ Test 5: Deprecated properties (accessibilityRole, accessibilityLabel, pointerEvents) are removed
  ✓ Test 6: BottomNav component uses modern role="button" and aria-label attributes
  ✓ Test 7: Full OAuth lifecycle (Login -> Profile -> Favorites -> Search -> Logout) executes cleanly without Firestore errors

📊 Remediation Test Suite Passed: 7 / 7 (100%)
```

### 6.2 Full Application Authentication & Navigation Regression
- `googleOAuthCallbackScenarios.test.mjs`: **7 / 7 Passed (100%)**
- `googleOAuthMigration.test.mjs`: **12 / 12 Passed (100%)**
- `navigationAndCallbackFlow.test.mjs`: **6 / 6 Passed (100%)**
- `supabaseAuth.test.mjs`: **29 / 29 Passed (100%)**
- `emailAuthVerificationWorkflow.test.mjs`: **12 / 12 Passed (100%)**
- `phase2SupabaseAuthIntegration.test.mjs`: **10 / 10 Passed (100%)**
- `platformAuthTesting.test.mjs`: **6 / 6 Passed (100%)**

---

## 7. Operational Guidelines & Remaining Considerations

1. **Firestore Security Rules**:
   [`firestore.rules`](firestore.rules) remains strictly locked down with `isOwner(userId)` checks. No rules were weakened, maintaining strict data isolation for legacy Firebase collections.

2. **Firebase Coexistence**:
   Firebase client initialization and dependencies remain completely intact for storage and fallback services without throwing unhandled exceptions.

3. **Database Schema State**:
   Per the task instructions, no remote database modifications or SQL executions were performed. When `public.user_deficiencies` is migrated to the remote database in a future phase, `HomeScreen.js` will automatically query and display active nutritional deficiencies without requiring further frontend code changes.

