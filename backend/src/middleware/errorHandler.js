// ── Central error handler ─────────────────────────────
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = { message: 'Resource not found', statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = { message: `${field} already exists`, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map(e => e.message);
    error = { message: messages.join('. '), statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }
  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  // Multer / File Upload errors
  if (err.name === 'MulterError' || (err.message && err.message.includes('Only PDF files are allowed'))) {
    error = { message: err.message, statusCode: 400 };
  }

  const statusCode = error.statusCode || err.statusCode || 500;
  const requestId = req.id || `req_${Date.now()}`;

  console.error(`[ERROR] [${requestId}] [${req.method}] ${req.path || req.url} → ${statusCode}: ${error.message}`);

  const clientMessage = (statusCode === 500 && process.env.NODE_ENV === 'production')
    ? 'An internal server error occurred.'
    : (error.message || 'Server Error');

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
