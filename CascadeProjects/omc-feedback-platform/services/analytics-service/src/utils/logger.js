const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Get log level from environment or default to info
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  levels: logLevels,
  format: logFormat,
  defaultMeta: { service: 'analytics-service' },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'analytics-service.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logDir, 'analytics-service-error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add request context to logs
logger.requestContext = (req) => {
  return {
    userId: req.user?.id,
    companyId: req.user?.companyId,
    ip: req.ip,
    method: req.method,
    path: req.path,
    query: req.query,
    requestId: req.headers['x-request-id'] || 'unknown'
  };
};

module.exports = logger;
