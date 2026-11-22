# FoodieBite — Manual Dashboard Setup Checklist

This document details all external cloud dashboard adjustments required to complete the migration to the Render production backend and ensure Google OAuth and CORS function smoothly across Web and Android.

---

## 1. Render Dashboard

| Setting Location | Current Value | Required Production Value | Action Required | Target Platform |
| :--- | :--- | :--- | :--- | :--- |
| **Render Dashboard** > `foodiebite-backend` > **Environment** > `CLIENT_URL` | Unset or `http://localhost:3000` | `https://sham-2005.github.io` | Add or update `CLIENT_URL` to allow GitHub Pages CORS requests. | Web |
| **Render Dashboard** > `foodiebite-backend` > **Environment** > `JWT_SECRET` | Development default or unset | Random 32+ character alphanumeric secret | Set a persistent strong secret so JWT tokens don't invalidate between restarts. | Both (Web & Android) |

---

## 2. Supabase Auth Dashboard

**Dashboard**: [https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr](https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr)

| Setting Location | Current Value | Required Production Value | Action Required | Target Platform |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** > **URL Configuration** > **Site URL** | `http://localhost:3000` | `https://sham-2005.github.io/foodiebite/` | Set the default canonical URL for email verification and OAuth callbacks. | Web |
| **Auth** > **URL Configuration** > **Redirect URLs** | `http://localhost:3000/**` | Include: <br>• `https://sham-2005.github.io/foodiebite/**`<br>• `https://sham-2005.github.io/foodiebite/auth/callback`<br>• `foodiebite://**`<br>• `foodiebite://auth/callback` | Add production web and Android custom scheme redirect URLs to the whitelist. | Both (Web & Android) |
| **Auth** > **Providers** > **Google** | Enabled | Ensure `Client ID` matches `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com` | Verify Google provider credentials match the Google Cloud project. | Both (Web & Android) |

---

## 3. Google Cloud Console

**Dashboard**: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)  
**Project**: `my-bot-504415`

| Setting Location | Current Value | Required Production Value | Action Required | Target Platform |
| :--- | :--- | :--- | :--- | :--- |
| **Credentials** > Web Client (`287461588416-...`) > **Authorized JavaScript origins** | `http://localhost:3000` | Add: <br>• `https://sham-2005.github.io`<br>• `https://wzhxalmixfeqszgwqeqr.supabase.co` | Permits Google Sign-In button and OAuth flow from the production web domain. | Web |
| **Credentials** > Web Client (`287461588416-...`) > **Authorized redirect URIs** | `http://localhost:3000/auth/callback` | Add: <br>• `https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1/callback`<br>• `https://sham-2005.github.io/foodiebite/auth/callback` | Allows Google to redirect back after user authorizes login. | Web |
| **Credentials** > Android Client | Package: `com.foodiebite.app` | Verify SHA-1: `75:F1:A7:6F:42:3C:70:54:8A:E1:FF:D5:79:C1:B9:EC:13:61:B6:7A` | Ensures Google Play Services validates native Android Google Sign-In requests. | Android |
