const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error(`Unhandled error: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Default error status and message
  let statusCode = err.statusCode || 500;
  let errorMessage = err.message || 'Internal Server Error';
  let errorType = 'Server error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
    errorType = 'Validation error';
  } else if (err.name === 'CastError') {
    // Mongoose cast error (e.g. invalid ObjectId)
    statusCode = 400;
    errorMessage = `Invalid ${err.path}: ${err.value}`;
    errorType = 'Invalid parameter';
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorMessage = 'Duplicate resource';
    errorType = 'Conflict error';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    // JWT errors
    statusCode = 401;
    errorMessage = 'Invalid or expired token';
    errorType = 'Authentication error';
  } else if (err.name === 'RateLimitError') {
    // Rate limiting error
    statusCode = 429;
    errorMessage = 'Too many requests';
    errorType = 'Rate limit exceeded';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: errorType,
    message: errorMessage,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  logger.warn(`Route not found: ${req.originalUrl}`, {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route not found: ${req.originalUrl}`
  });
};

/**
 * Validation error handler
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    logger.warn(`Validation error: ${err.message}`, {
      error: err.message,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
      details: err.details || undefined
    });
  }
  
  next(err);
};

/**
 * MongoDB error handler
 */
const mongoErrorHandler = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    logger.error(`MongoDB error: ${err.message}`, {
      error: err.message,
      code: err.code,
      path: req.path,
      method: req.method
    });
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Conflict error',
        message: 'Duplicate resource'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'A database error occurred'
    });
  }
  
  next(err);
};

/**
 * Rate limiting error handler
 */
const rateLimitHandler = (req, res, next) => {
  const err = new Error('Too many requests');
  err.statusCode = 429;
  err.name = 'RateLimitError';
  
  logger.warn(`Rate limit exceeded: ${req.ip}`, {
    ip: req.ip,
    path: req.path,
    method: req.method
  });
  
  res.status(429).json({
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many requests, please try again later'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  validationErrorHandler,
  mongoErrorHandler,
  rateLimitHandler
};
