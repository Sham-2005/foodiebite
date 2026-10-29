// ─────────────────────────────────────────────────────────────
//  backend/src/middleware/requestCorrelation.js
//  Request Correlation ID & Production-Safe Structured Logging Middleware
// ─────────────────────────────────────────────────────────────

function requestCorrelation(req, res, next) {
  // Extract existing or generate new correlation request ID
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = incomingId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startMs = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const status = res.statusCode;
    const level = status >= 500 ? 'ERROR' : (status >= 400 ? 'WARN' : 'INFO');

    // Safe sanitized log statement - no credentials, tokens, or body payload details
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${level}] [${requestId}] ${req.method} ${req.originalUrl || req.url} HTTP ${status} (${durationMs}ms)`);
    }
  });

  next();
}

module.exports = requestCorrelation;
