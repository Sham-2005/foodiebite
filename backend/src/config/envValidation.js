// ─────────────────────────────────────────────────────────────
//  backend/src/config/envValidation.js
//  Production Environment Configuration & Startup Validator
// ─────────────────────────────────────────────────────────────

const WEAK_JWT_SECRETS = new Set([
  'secret',
  'foodiebite_super_secret_key_change_in_production_2024',
  '123456',
  'password',
  'change_me'
]);

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;

  if (isProduction) {
    if (!jwtSecret) {
      throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable must be set in production mode.');
    }
    if (WEAK_JWT_SECRETS.has(jwtSecret.trim())) {
      throw new Error('FATAL CONFIGURATION ERROR: Weak default JWT_SECRET detected in production mode. Set a strong secret key.');
    }
  } else {
    if (!jwtSecret || WEAK_JWT_SECRETS.has(jwtSecret.trim())) {
      console.warn('⚠️ [Config Notice] Running with development JWT_SECRET. Override with strong secret for production deployment.');
    }
  }

  // Resend Email Service Checks
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    console.log(`✉️ [Email Config] Resend HTTPS API ready (Sender: ${process.env.RESEND_FROM || 'FoodieBite <onboarding@resend.dev>'})`);
  } else {
    console.warn('⚠️ [Email Notice] RESEND_API_KEY is not configured in backend/.env.');
  }

  return {
    valid: true,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    resendConfigured: Boolean(resendApiKey)
  };
}

module.exports = {
  validateEnv,
  WEAK_JWT_SECRETS
};
