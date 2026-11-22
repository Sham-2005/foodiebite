# FoodieBite — Vercel Production Frontend Deployment Guide

## 1. Architecture Overview

- **Frontend Hosting**: Vercel (`https://*.vercel.app` or custom domain)
- **Backend API Gateway**: Render (`https://foodiebite-backend.onrender.com/api`)
- **Backend Root URL**: `https://foodiebite-backend.onrender.com`
- **Database & Authentication**: Supabase (`https://wzhxalmixfeqszgwqeqr.supabase.co`)
- **Mobile Alignment**: The Android application (`com.foodiebite.app`) and Vercel Web application share the exact same backend API, database, and authentication provider.

---

## 2. Vercel Project Configuration

When deploying the repository to Vercel, configure the project settings as follows:

### A. Root Directory
- If deploying from the repository root: Set **Root Directory** to `frontend` (or leave as `.` with the root `vercel.json`).
- **Framework Preset**: `Other` (Webpack / Custom)
- **Build Command**: `npm run build`
- **Output Directory**: `build` (if root directory is `frontend`) or `frontend/build` (if root directory is `.`)
- **Install Command**: `npm install`

### B. Single Page Application (SPA) Routing (`vercel.json`)
The repository includes [`frontend/vercel.json`](file:///s:/files/food_app/frontend/vercel.json) and [`vercel.json`](file:///s:/files/food_app/vercel.json) to prevent 404 errors when navigating or refreshing routes like `/home`, `/signin`, or `/auth/callback`:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 3. Exact Environment Variables for Vercel

In your **Vercel Dashboard** > **Project Settings** > **Environment Variables**, configure the following variables (for Production, Preview, and Development environments):

| Variable Name | Exact Value | Safe for Public Bundle? | Purpose |
| :--- | :--- | :--- | :--- |
| `REACT_APP_API_URL` | `https://foodiebite-backend.onrender.com/api` | Yes | Backend API entry point |
| `NEXT_PUBLIC_API_URL` | `https://foodiebite-backend.onrender.com/api` | Yes | Alias for API entry point |
| `REACT_APP_SUPABASE_URL` | `https://wzhxalmixfeqszgwqeqr.supabase.co` | Yes | Supabase database & auth endpoint |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wzhxalmixfeqszgwqeqr.supabase.co` | Yes | Alias for Supabase URL |
| `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB` | Yes | Public Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB` | Yes | Alias for Supabase anon key |
| `REACT_APP_GOOGLE_WEB_CLIENT_ID` | `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com` | Yes | Google OAuth Client ID |
| `PUBLIC_URL` | `/` | Yes | Ensures assets resolve from root on Vercel |

> [!IMPORTANT]
> **Never** add Supabase service-role keys (`SUPABASE_SERVICE_ROLE_KEY`), JWT secrets (`JWT_SECRET`), or Google OAuth Client Secrets to Vercel. Those secrets belong strictly on the Render backend.

---

## 4. Manual Cloud Configuration Checklist

### 1. Render Dashboard (Backend CORS)
1. Navigate to your [Render Dashboard](https://dashboard.render.com/) > `foodiebite-backend` > **Environment**.
2. Set or update `CLIENT_URL` to your production Vercel domain (e.g. `https://foodiebite.vercel.app` or your custom domain).
3. The backend code in [`backend/src/server.js`](file:///s:/files/food_app/backend/src/server.js) automatically accepts all `*.vercel.app` origins, so preview deployments will function automatically without manual whitelisting.

### 2. Supabase Dashboard (Auth Redirect URLs)
1. Go to [Supabase URL Configuration](https://supabase.com/dashboard/project/wzhxalmixfeqszgwqeqr/auth/url-configuration).
2. Set **Site URL** to your production Vercel domain: `https://<your-app>.vercel.app/`.
3. Add the following to **Redirect URLs (Allow list)**:
   - `https://*.vercel.app/**`
   - `https://*.vercel.app/auth/callback`
   - `https://<your-exact-subdomain>.vercel.app/**`
   - `https://<your-exact-subdomain>.vercel.app/auth/callback`
   - `foodiebite://**` (Android native)
   - `http://localhost:3000/**` (Local dev)

### 3. Google Cloud Console (OAuth Allowed Origins & Redirects)
1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) for project `my-bot-504415`.
2. Under **OAuth 2.0 Client IDs**, select Web Client `287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com`.
3. In **Authorized JavaScript origins**, add:
   - `https://<your-app>.vercel.app`
4. In **Authorized redirect URIs**, add:
   - `https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1/callback` (Supabase auth exchange)
   - `https://<your-app>.vercel.app/auth/callback` (Direct callback landing)
