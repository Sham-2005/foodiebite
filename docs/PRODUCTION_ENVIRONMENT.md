# FoodieBite — Production Environment & Configuration Reference

## 1. Single Architecture Topology

FoodieBite enforces a strict single-backend architecture:

```
                          ┌───────────────────────────────────────────────┐
                          │            PRODUCTION DATABASE & AUTH         │
                          │        Supabase PostgreSQL & GoTrue Auth      │
                          │   https://wzhxalmixfeqszgwqeqr.supabase.co    │
                          └───────────────────────┬───────────────────────┘
                                                  │
                                                  │ (Direct Auth & Storage)
                                                  ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐        ┌───────────────────────────────┐
│       PRODUCTION WEB          │        │       PRODUCTION BACKEND      │        │      PRODUCTION ANDROID       │
│  GitHub Pages Deployed App    ├───────►│    Render Node.js / Express   │◄───────┤     Native Android APK        │
│ sham-2005.github.io/foodiebite│        │foodiebite-backend.onrender.com│        │      com.foodiebite.app       │
└───────────────────────────────┘        └───────────────────────────────┘        └───────────────────────────────┘
```

---

## 2. Environment Variables Matrix

### A. Web Frontend (Webpack & Browser Client)

Stored in [`frontend/.env`](file:///s:/files/food_app/frontend/.env) and root [`.env`](file:///s:/files/food_app/.env):

| Variable Name | Production Value | Development Value | Exposure | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `REACT_APP_API_URL` | `https://foodiebite-backend.onrender.com/api` | `http://localhost:5000/api` | Public Bundle | API gateway base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wzhxalmixfeqszgwqeqr.supabase.co` | `https://wzhxalmixfeqszgwqeqr.supabase.co` | Public Bundle | Supabase project endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB` | `sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB` | Public Bundle | Supabase public anon key |
| `REACT_APP_GOOGLE_WEB_CLIENT_ID`| `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com` | `287461588416-...` | Public Bundle | Google OAuth client ID |

### B. Android Native Application

Configured in [`frontend/android/app/google-services.json`](file:///s:/files/food_app/frontend/android/app/google-services.json) and [`frontend/src/config/apiConfig.js`](file:///s:/files/food_app/frontend/src/config/apiConfig.js):

| Parameter | Value | Location | Notes |
| :--- | :--- | :--- | :--- |
| Application ID | `com.foodiebite.app` | `build.gradle` | Canonical Android package name |
| Production API Base | `https://foodiebite-backend.onrender.com/api` | `apiConfig.js` | Enforced default on mobile release |
| Web Client ID (Google Sign-In) | `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com` | `googleAuth.android.js` | ID token exchange with Supabase |
| Deep-Link Scheme | `foodiebite://` | `AndroidManifest.xml` | Used for OAuth redirect returns |

### C. Backend API Server (Render Platform)

Configured securely in the Render Environment Dashboard:

| Variable Name | Recommended Value | Security Level | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | `10000` | Standard | Server binding port |
| `NODE_ENV` | `production` | Standard | Production mode execution |
| `CLIENT_URL` | `https://sham-2005.github.io` | Standard | Primary CORS origin |
| `JWT_SECRET` | *(Generated random 32+ char secret)* | **Critical Secret** | Signs & validates local JWT tokens |
| `JWT_EXPIRE` | `7d` | Standard | Token duration |
| `SUPABASE_URL` | `https://wzhxalmixfeqszgwqeqr.supabase.co` | Standard | Backend Supabase client |
| `SUPABASE_KEY` | *(Supabase Service Role Key)* | **Critical Secret** | Admin database operations & user sync |
| `BREVO_API_KEY`| `xkeysib_your_brevo_api_key_here` | **Primary Secret** | Primary transactional & daily recommendation email engine |
| `BREVO_SENDER_EMAIL` | `foodiebite881@gmail.com` | Standard | Verified Brevo sender address |
| `BREVO_SENDER_NAME` | `FoodieBite` | Standard | Sender display name |
| `RESEND_API_KEY`| `re_your_resend_api_key_here` | Secret | Secondary fallback transactional email API |
| `RESEND_FROM` | `FoodieBite <onboarding@resend.dev>` | Standard | Secondary fallback sender |

---

## 3. Strict Boundary Rules

1. **Zero Secret Leaks**: No service-role keys, database passwords, or JWT secrets are ever bundled into Webpack or React Native APK builds.
2. **Row-Level Security**: All data modifications through the frontend client use public credentials bound to authenticated user UUIDs.
3. **No Secondary Backends**: Both Web and Android consume the exact same endpoints at `https://foodiebite-backend.onrender.com`.
