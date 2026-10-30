/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  scripts/securityData/endpoints.js
 *  FoodieBite Backend API Endpoint Inventory (105 Endpoints)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

module.exports = [
  // Operational & Health (server.js)
  { endpoint: '/health', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Operational', risk: 'Low' },
  { endpoint: '/ready', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Operational', risk: 'Low' },
  { endpoint: '/api', method: 'GET', auth: 'None', role: 'Public (Dev Only)', file: 'backend/src/server.js', category: 'Documentation', risk: 'Low' },
  { endpoint: '/api/debug/ai', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Diagnostic', risk: 'Medium' },
  { endpoint: '/api/debug/tars', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Diagnostic', risk: 'Low' },
  { endpoint: '/api/debug/gemini', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Diagnostic', risk: 'Low' },
  { endpoint: '/api/debug/firestore', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/server.js', category: 'Diagnostic', risk: 'Medium' },
  { endpoint: '/uploads/:filename', method: 'GET', auth: 'None (Static Express)', role: 'Public', file: 'backend/src/server.js', category: 'Static Files', risk: 'Critical' },

  // Authentication (routes/authRoutes.js)
  { endpoint: '/api/auth/register', method: 'POST', auth: 'None', role: 'Public', file: 'backend/src/controllers/authController.js', category: 'Authentication', risk: 'High' },
  { endpoint: '/api/auth/login', method: 'POST', auth: 'None', role: 'Public', file: 'backend/src/controllers/authController.js', category: 'Authentication', risk: 'Critical' },
  { endpoint: '/api/auth/me', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/authController.js', category: 'Authentication', risk: 'Low' },
  { endpoint: '/api/auth/password', method: 'PUT', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/authController.js', category: 'Authentication', risk: 'Medium' },

  // User Management & Preferences (routes/userRoutes.js)
  { endpoint: '/api/user/sync', method: 'POST', auth: 'None (Unprotected)', role: 'Public / Any User', file: 'backend/src/controllers/userController.js', category: 'User Management', risk: 'Critical' },
  { endpoint: '/api/user/profile', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'User Profile', risk: 'Low' },
  { endpoint: '/api/user/profile', method: 'PUT', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'User Profile', risk: 'Low' },
  { endpoint: '/api/user/preferences', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'User Preferences', risk: 'Low' },
  { endpoint: '/api/user/preferences', method: 'PUT', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'User Preferences', risk: 'Low' },
  { endpoint: '/api/user/test-daily-email', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Email Testing', risk: 'Medium' },
  { endpoint: '/api/user/favorites', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Favorites', risk: 'Low' },
  { endpoint: '/api/user/favorites/food', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Favorites', risk: 'Low' },
  { endpoint: '/api/user/favorites/food/:foodId', method: 'DELETE', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Favorites', risk: 'Low' },
  { endpoint: '/api/user/medical', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Medical Reports', risk: 'Medium' },
  { endpoint: '/api/user/medical', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Medical Reports', risk: 'High' },
  { endpoint: '/api/user/medical/:reportId', method: 'DELETE', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Medical Reports', risk: 'High' },
  { endpoint: '/api/user/search-history', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Search History', risk: 'Low' },
  { endpoint: '/api/user/search-history', method: 'DELETE', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Search History', risk: 'Low' },
  { endpoint: '/api/user/behavior/event', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Behavior Learning', risk: 'Low' },
  { endpoint: '/api/user/behavior/profile', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Behavior Learning', risk: 'Low' },
  { endpoint: '/api/user/behavior/reset', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Behavior Learning', risk: 'Low' },
  { endpoint: '/api/user/behavior/learning', method: 'DELETE', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/userController.js', category: 'Behavior Learning', risk: 'Low' },

  // Medical Reports & Biomarkers (routes/medicalRoutes.js)
  { endpoint: '/api/medical/upload', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Medical Reports', risk: 'High' },
  { endpoint: '/api/medical/reports', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Medical Reports', risk: 'Medium' },
  { endpoint: '/api/medical/report/:reportId', method: 'GET', auth: 'Bearer Token (IDOR Flaw)', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Medical Reports', risk: 'Critical' },
  { endpoint: '/api/medical/report/:reportId', method: 'DELETE', auth: 'Bearer Token (IDOR Flaw)', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Medical Reports', risk: 'High' },
  { endpoint: '/api/medical/health-profile', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Health Profile', risk: 'Medium' },
  { endpoint: '/api/medical/manual-values', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Biomarkers', risk: 'Low' },
  { endpoint: '/api/medical/history', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/medicalController.js', category: 'Biomarkers', risk: 'Low' },

  // Food & Recommendations (routes/foodRoutes.js)
  { endpoint: '/api/food/scan-nutrition', method: 'POST', auth: 'None', role: 'Public', file: 'backend/src/controllers/foodController.js', category: 'Nutrition OCR', risk: 'Medium' },
  { endpoint: '/api/food/recommendations', method: 'GET', auth: 'Optional Bearer Token', role: 'Public / User', file: 'backend/src/controllers/foodController.js', category: 'AI Recommendations', risk: 'Low' },
  { endpoint: '/api/food/search', method: 'GET', auth: 'Optional Bearer Token', role: 'Public / User', file: 'backend/src/controllers/foodController.js', category: 'Food Search', risk: 'Low' },
  { endpoint: '/api/food/delivery-link', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/controllers/foodController.js', category: 'Food Delivery', risk: 'Low' },
  { endpoint: '/api/food/compare', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/foodController.js', category: 'Food Comparison', risk: 'Low' },
  { endpoint: '/api/food/mood', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/foodController.js', category: 'AI Recommendations', risk: 'Low' },
  { endpoint: '/api/food/weather', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/foodController.js', category: 'AI Recommendations', risk: 'Low' },
  { endpoint: '/api/food/dna', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/foodController.js', category: 'AI Recommendations', risk: 'Low' },
  { endpoint: '/api/food/:barcode', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/controllers/foodController.js', category: 'Barcode Lookup', risk: 'Low' },

  // AI Nutrition Coach (routes/coachRoutes.js)
  { endpoint: '/api/coach', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/coachController.js', category: 'AI Coach Chat', risk: 'Medium' },

  // Feedback & Inquiries (routes/feedbackRoutes.js)
  { endpoint: '/api/feedback', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/feedbackController.js', category: 'User Feedback', risk: 'Low' },
  { endpoint: '/api/feedback/:id/resolve', method: 'PUT', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/feedbackController.js', category: 'Admin Feedback', risk: 'Medium' },
  { endpoint: '/api/feedback/:id', method: 'DELETE', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/feedbackController.js', category: 'Admin Feedback', risk: 'Medium' },

  // Administration Portal & Management (routes/adminRoutes.js)
  { endpoint: '/api/admin/login', method: 'POST', auth: 'None (Hardcoded Creds)', role: 'Public (Admin Portal)', file: 'backend/src/routes/adminRoutes.js', category: 'Admin Auth', risk: 'Critical' },
  { endpoint: '/api/admin/create-account', method: 'POST', auth: 'None', role: 'Disabled (403)', file: 'backend/src/routes/adminRoutes.js', category: 'Admin Auth', risk: 'Low' },
  { endpoint: '/api/admin/overview', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Admin Dashboard', risk: 'Medium' },
  { endpoint: '/api/admin/users', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'User Management', risk: 'High' },
  { endpoint: '/api/admin/users/:userId', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'User Management', risk: 'High' },
  { endpoint: '/api/admin/users/:userId/disable', method: 'PUT', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'User Management', risk: 'High' },
  { endpoint: '/api/admin/users/:userId', method: 'DELETE', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'User Management', risk: 'High' },
  { endpoint: '/api/admin/analytics', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Admin Analytics', risk: 'Medium' },
  { endpoint: '/api/admin/analytics/feature-usage', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Admin Analytics', risk: 'Medium' },
  { endpoint: '/api/admin/audit-logs', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Audit Logs', risk: 'Medium' },
  { endpoint: '/api/admin/export/users', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Data Export', risk: 'High' },
  { endpoint: '/api/admin/feedback', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Admin Feedback', risk: 'Medium' },
  { endpoint: '/api/admin/feedback/stats', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Admin Feedback', risk: 'Medium' },
  { endpoint: '/api/admin/notification-settings', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'System Config', risk: 'Medium' },
  { endpoint: '/api/admin/notification-settings', method: 'PUT', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'System Config', risk: 'High' },
  { endpoint: '/api/admin/restaurant-requests', method: 'GET', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Merchant Moderation', risk: 'Medium' },
  { endpoint: '/api/admin/restaurant-requests/:id', method: 'PUT', auth: 'Bearer Token', role: 'Admin Only', file: 'backend/src/controllers/adminController.js', category: 'Merchant Moderation', risk: 'High' },

  // Analytics & Intelligence Ingestion (routes/analyticsRoutes.js)
  { endpoint: '/api/analytics/events', method: 'POST', auth: 'None', role: 'Public / Guest', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Ingestion', risk: 'Low' },
  { endpoint: '/api/analytics/events/batch', method: 'POST', auth: 'None', role: 'Public / Guest', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Ingestion', risk: 'Low' },
  { endpoint: '/api/analytics/summary', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/analyticsController.js', category: 'User Analytics', risk: 'Low' },
  { endpoint: '/api/analytics/overview', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },
  { endpoint: '/api/analytics/recommendations', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },
  { endpoint: '/api/analytics/users', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },
  { endpoint: '/api/analytics/experiments', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },
  { endpoint: '/api/analytics/performance', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },
  { endpoint: '/api/analytics/trends', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/controllers/analyticsIntelligenceController.js', category: 'Analytics Intelligence', risk: 'Medium' },

  // Merchant Portal & Requests (routes/merchantRoutes.js)
  { endpoint: '/api/merchant/restaurant-requests', method: 'POST', auth: 'Bearer Token', role: 'Merchant, Admin', file: 'backend/src/controllers/merchantController.js', category: 'Merchant Portal', risk: 'Medium' },
  { endpoint: '/api/merchant/restaurant-requests', method: 'GET', auth: 'Bearer Token', role: 'Merchant, Admin', file: 'backend/src/controllers/merchantController.js', category: 'Merchant Portal', risk: 'Medium' },
  { endpoint: '/api/merchant/restaurant-requests/:id', method: 'GET', auth: 'Bearer Token', role: 'Merchant, Admin', file: 'backend/src/controllers/merchantController.js', category: 'Merchant Portal', risk: 'Medium' },

  // Approved Restaurants & Nearby Discovery (routes/restaurantRoutes.js & nearbyRoutes.js)
  { endpoint: '/api/restaurants/approved', method: 'GET', auth: 'None', role: 'Public', file: 'backend/src/routes/restaurantRoutes.js', category: 'Directory', risk: 'Low' },
  { endpoint: '/api/nearby/restaurants', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/nearbyController.js', category: 'Geolocation', risk: 'Medium' },
  { endpoint: '/api/nearby/geocode', method: 'GET', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/controllers/nearbyController.js', category: 'Geolocation', risk: 'Medium' },

  // Email Campaigns, Brevo & Schedulers (routes/emailRoutes.js)
  { endpoint: '/api/email/status', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email System', risk: 'Medium' },
  { endpoint: '/api/email/verify', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email System', risk: 'Medium' },
  { endpoint: '/api/email/test', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email System', risk: 'Medium' },
  { endpoint: '/api/email/send-test', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email System', risk: 'Medium' },
  { endpoint: '/api/email/evaluate-recipients', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'Medium' },
  { endpoint: '/api/email/campaigns', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'Medium' },
  { endpoint: '/api/email/campaigns/:id', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'Medium' },
  { endpoint: '/api/email/campaigns', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'High' },
  { endpoint: '/api/email/campaigns/:id/start', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'High' },
  { endpoint: '/api/email/campaigns/:id/retry', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'Medium' },
  { endpoint: '/api/email/welcome', method: 'POST', auth: 'Bearer Token', role: 'User, Merchant, Admin', file: 'backend/src/routes/emailRoutes.js', category: 'Email System', risk: 'Low' },
  { endpoint: '/api/email/welcome-all', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Campaigns', risk: 'High' },
  { endpoint: '/api/email/webhook', method: 'POST', auth: 'Webhook Secret', role: 'Public / Brevo Webhook', file: 'backend/src/routes/emailRoutes.js', category: 'Webhooks', risk: 'Medium' },
  { endpoint: '/api/email/brevo/webhook', method: 'POST', auth: 'Webhook Secret', role: 'Public / Brevo Webhook', file: 'backend/src/routes/emailRoutes.js', category: 'Webhooks', risk: 'Medium' },
  { endpoint: '/api/email/unsubscribe', method: 'GET', auth: 'HMAC Query Token', role: 'Public', file: 'backend/src/routes/emailRoutes.js', category: 'Unsubscribe Flow', risk: 'Low' },
  { endpoint: '/api/email/unsubscribe', method: 'POST', auth: 'None / HMAC Token', role: 'Public', file: 'backend/src/routes/emailRoutes.js', category: 'Unsubscribe Flow', risk: 'Low' },
  { endpoint: '/api/email/daily-recommendations/status', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'Medium' },
  { endpoint: '/api/email/daily-recommendations/config', method: 'PUT', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'High' },
  { endpoint: '/api/email/daily-recommendations/trigger', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'High' },
  { endpoint: '/api/email/daily-recommendations/test', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'Medium' },
  { endpoint: '/api/email/daily-recommendations/retry', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'Medium' },
  { endpoint: '/api/email/daily-recommendations/preview', method: 'POST', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'Medium' },
  { endpoint: '/api/email/daily-recommendations/runs', method: 'GET', auth: 'Admin Key or Admin Bearer', role: 'Admin Only', file: 'backend/src/routes/emailRoutes.js', category: 'Email Scheduler', risk: 'Medium' }
];
