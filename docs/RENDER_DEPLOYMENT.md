# FoodieBite — Render Production Backend Deployment & Operations Guide

## 1. Executive Summary

FoodieBite operates a single, centralized, enterprise-grade production backend deployed on Render:

- **Production Backend URL**: `https://foodiebite-backend.onrender.com`
- **Deployment Status**: LIVE
- **Architecture**: Single Source of Truth for both Web (`https://sham-2005.github.io/foodiebite/`) and Android Native APK (`com.foodiebite.app`).
- **Database Engine**: Supabase Cloud PostgreSQL (32 relational tables with Row-Level Security).
- **Core Technology**: Node.js 22 LTS, Express 4.19, Helmet, Express Rate Limit, JWT (Dual-Auth Supabase + Local HS256).

---

## 2. Verified Live Endpoints

The Render backend has been probed and verified via non-destructive live HTTP testing:

| Endpoint | Method | Status | Purpose | Verified Response |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | **200 OK** | Operational health probe | `{"success":true,"status":"pass","message":"FoodieBite API is running","version":"2.0.0"}` |
| `/ready` | `GET` | **200 OK** | Readiness probe | `{"success":true,"ready":true,"services":{"aiEngine":"healthy","nearbyService":"healthy"}}` |
| `/api/debug/ai` | `GET` | **200 OK** | Local AI engine diagnostics | `{"success":true,"engine":"FoodieBite Local AI Engine","provider":"local_deterministic"}` |
| `/api/debug/supabase` | `GET` | **200 OK** | Supabase connectivity check | `{"supabaseConnected":true,"error":null}` |
| `/api/debug/gemini` | `GET` | **200 OK** | Zero-external AI audit | `{"externalAiCalls":0,"apiKeyPresent":false,"geminiConfigured":false}` |
| `/api/food/recommendations` | `GET` | **200 OK** | Smart food recommendations | `{"success":true,"source":"cache","recommendationStrategy":"context_aware"}` |
| `/api/foods/search?q=apple` | `GET` | **200 OK** | OpenFoodFacts food proxy | Returns normalized foods and Nutri-Scores |
| `/api/coach` | `POST` | **401 Unauthorized** | AI Nutrition Coach | Protected by JWT authentication middleware |
| `/api/auth/me` | `GET` | **401 Unauthorized** | User profile session | Protected by JWT authentication middleware |
| `/api/admin/metrics/overview`| `GET` | **401 Unauthorized** | Admin operations | Protected by Superadmin role verification |

---

## 3. Render Dashboard Environment Variables

In your [Render Dashboard](https://dashboard.render.com/) under `foodiebite-backend` > **Environment**, verify and configure the following variables:

```bash
# Server Runtime
PORT=10000
NODE_ENV=production

# Client Application URL (Allowed CORS Origin)
CLIENT_URL=https://sham-2005.github.io

# Security & Session Secrets
JWT_SECRET=<strong-random-32-char-production-secret>
JWT_EXPIRE=7d

# Supabase Cloud Database & Storage (Single Source of Truth)
SUPABASE_URL=https://wzhxalmixfeqszgwqeqr.supabase.co
SUPABASE_KEY=<supabase-anon-or-service-role-key>

# Primary Email Delivery Service (Brevo REST API v3 - Verified Sender)
BREVO_API_KEY=xkeysib_your_brevo_api_key_here
BREVO_SENDER_EMAIL=foodiebite881@gmail.com
BREVO_SENDER_NAME=FoodieBite
DAILY_RECOMMENDATION_ENABLED=true
DAILY_RECOMMENDATION_CRON=0 * * * *
DAILY_RECOMMENDATION_TIMEZONE=Asia/Kolkata

# Secondary Email Fallback Service (Resend HTTPS API)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM=FoodieBite <onboarding@resend.dev>

# AI Engine
AI_PROVIDER=custom_rest
AI_MODEL=foodiebite-ai-v1
```

---

## 4. CORS Whitelist Specification

The backend server in [`backend/src/server.js`](file:///s:/files/food_app/backend/src/server.js) enforces the following production origin rules:

1. **Permitted Web Origins**:
   - `https://sham-2005.github.io`
   - `https://sham-2005.github.io/foodiebite`
   - All `*.github.io` subdomains for the project repository
   - `http://localhost:3000` & `http://127.0.0.1:3000` (Local dev)
2. **Permitted Mobile & Native Origins**:
   - `capacitor://localhost`
   - `ionic://localhost`
   - `http://localhost`
   - Requests without an `Origin` header (such as native Android `OkHttp`, `curl`, and Postman).
3. **Graceful Handling**:
   - Instead of throwing an unhandled 500 error on unknown origins, Express CORS gracefully returns a `403/Forbidden` or omits `Access-Control-Allow-Origin`, preventing server crashes.

---

## 5. Maintenance & Log Monitoring

- **Render Live Logs**: Accessible at `https://dashboard.render.com/web/<service-id>/logs`
- **Correlation IDs**: Every inbound request receives an `x-correlation-id` header logged on failure to trace cross-platform requests from Web or Android.
