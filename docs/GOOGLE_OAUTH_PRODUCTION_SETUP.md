# FoodieBite — Google Sign-In & OAuth Production Setup Guide

## 1. Authentication Architecture

FoodieBite utilizes a unified Supabase Authentication GoTrue architecture for Google Sign-In across both platforms:

```
[Web Client: Browser]
   │
   ▼
Supabase GoTrue OAuth (signInWithOAuth)
   │
   ├──> Redirects to Google Consent Screen
   └──> Returns to https://sham-2005.github.io/foodiebite/auth/callback?code=...
            │
            ▼
Exchange PKCE code for session -> Session saved to localStorage & AppContext

[Android Client: Native APK]
   │
   ▼
@react-native-google-signin/google-signin
   │
   ├──> Native Google Play Services Account Picker (webClientId)
   └──> Returns Google ID Token (JWT)
            │
            ▼
Supabase Auth (signInWithIdToken) -> Session saved to AsyncStorage & AppContext
```

---

## 2. Verified Google Cloud & Keystore Credentials

From inspection of [`frontend/android/app/google-services.json`](file:///s:/files/food_app/frontend/android/app/google-services.json) and keytool analysis of [`frontend/android/app/debug.keystore`](file:///s:/files/food_app/frontend/android/app/debug.keystore):

- **Google Cloud Project**: `my-bot-504415` (Project Number: `433101398092`)
- **Web OAuth Client ID**: `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com`
- **Android Package Name**: `com.foodiebite.app`
- **Android Debug Keystore SHA-1**:
  `75:F1:A7:6F:42:3C:70:54:8A:E1:FF:D5:79:C1:B9:EC:13:61:B6:7A`
- **Android Debug Keystore SHA-256**:
  `36:2C:E2:1A:E3:08:CF:4B:5C:B7:C6:EB:1D:50:75:D9:1A:38:D1:D4:C4:50:A2:9F:34:F1:63:AB:E5:D0:6F:C7`

---

## 3. Google Cloud Console Configuration Requirements

In your [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

### A. Web OAuth 2.0 Client ID
Select Web Client: `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com`

**Authorized JavaScript Origins**:
1. `https://sham-2005.github.io`
2. `https://wzhxalmixfeqszgwqeqr.supabase.co`
3. `http://localhost:3000` (Local dev)
4. `http://127.0.0.1:3000` (Local dev)

**Authorized Redirect URIs**:
1. `https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1/callback` *(Supabase OAuth callback)*
2. `https://sham-2005.github.io/foodiebite/auth/callback` *(Web application callback)*
3. `http://localhost:3000/auth/callback` *(Local dev callback)*

### B. Android OAuth 2.0 Client ID
Verify an Android OAuth Client exists with:
- **Package name**: `com.foodiebite.app`
- **SHA-1 certificate fingerprint**: `75:F1:A7:6F:42:3C:70:54:8A:E1:FF:D5:79:C1:B9:EC:13:61:B6:7A`

---

## 4. Supabase Auth Dashboard Settings

In your [Supabase Dashboard](https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr/auth/url-configuration):

1. **Site URL**:
   `https://sham-2005.github.io/foodiebite/`
2. **Redirect URLs (Allow list)**:
   - `https://sham-2005.github.io/foodiebite/**`
   - `https://sham-2005.github.io/foodiebite/auth/callback`
   - `foodiebite://**`
   - `foodiebite://auth/callback`
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/callback`
3. **Google Provider Configuration**:
   Under **Authentication** > **Providers** > **Google**:
   - Enable Google: **ON**
   - Client ID: `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com`
   - Client Secret: *(Google Cloud OAuth Client Secret)*
   - Skip nonce check: **Disabled** (or Enabled for native ID tokens)
