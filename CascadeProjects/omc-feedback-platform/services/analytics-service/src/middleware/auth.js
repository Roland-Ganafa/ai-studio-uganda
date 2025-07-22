const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user data to request
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication error',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || [],
      companyId: decoded.companyId,
      permissions: decoded.permissions || []
    };
    
    logger.debug('User authenticated', {
      userId: req.user.id,
      roles: req.user.roles,
      companyId: req.user.companyId
    });
    
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(401).json({
      success: false,
      error: 'Authentication error',
      message: 'Invalid token'
    });
  }
};

/**
 * Authorization middleware
 * Checks if user has required roles
 * @param {Array} roles - Required roles
 */
exports.authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      // Check if user exists and has roles
      if (!req.user || !req.user.roles) {
        return res.status(403).json({
          success: false,
          error: 'Authorization error',
          message: 'Access denied'
        });
      }
      
      // Check if user has any of the required roles
      const hasRole = req.user.roles.some(role => roles.includes(role));
      
      if (!hasRole) {
        logger.warn('Authorization failed: insufficient permissions', {
          userId: req.user.id,
          userRoles: req.user.roles,
          requiredRoles: roles
        });
        
        return res.status(403).json({
          success: false,
          error: 'Authorization error',
          message: 'Insufficient permissions'
        });
      }
      
      logger.debug('User authorized', {
        userId: req.user.id,
        roles: req.user.roles,
        requiredRoles: roles
      });
      
      next();
    } catch (error) {
      logger.error(`Authorization error: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  };
};

/**
 * Company resource access middleware
 * Ensures user can only access resources for their company
 */
exports.checkCompanyAccess = async (req, res, next) => {
  try {
    // Skip for admins
    if (req.user.roles.includes('admin')) {
      return next();
    }
    
    // Get company ID from request (params, query, or body)
    const resourceCompanyId = 
      req.params.companyId || 
      req.query.companyId || 
      (req.body && req.body.companyId);
    
    // If no company ID in request, continue
    if (!resourceCompanyId) {
      return next();
    }
    
    // Check if user's company matches resource company
    if (req.user.companyId && resourceCompanyId !== req.user.companyId.toString()) {
      logger.warn('Company access denied', {
        userId: req.user.id,
        userCompanyId: req.user.companyId,
        resourceCompanyId
      });
      
      return res.status(403).json({
        success: false,
        error: 'Authorization error',
        message: 'You do not have permission to access resources for this company'
      });
    }
    
    next();
  } catch (error) {
    logger.error(`Company access check error: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};
