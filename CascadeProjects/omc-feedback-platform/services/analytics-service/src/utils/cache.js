const { createClient } = require('redis');
const logger = require('./logger');

// Redis client
let client = null;
let connected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectInterval = 5000; // 5 seconds

/**
 * Initialize Redis client
 * @returns {Promise<Object>} - Redis client
 */
const initialize = async () => {
  try {
    // Get Redis URL from environment variables
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Create Redis client
    client = createClient({
      url
    });
    
    // Setup event handlers
    client.on('error', (err) => {
      logger.error(`Redis error: ${err.message}`, {
        error: err.message,
        stack: err.stack
      });
      
      if (connected) {
        connected = false;
        handleDisconnect();
      }
    });
    
    client.on('connect', () => {
      logger.info('Connected to Redis server');
    });
    
    client.on('ready', () => {
      connected = true;
      reconnectAttempts = 0;
      logger.info('Redis client is ready');
    });
    
    client.on('end', () => {
      connected = false;
      logger.info('Redis connection closed');
    });
    
    client.on('reconnecting', () => {
      logger.info('Reconnecting to Redis server...');
    });
    
    // Connect to Redis
    await client.connect();
    
    return client;
  } catch (error) {
    logger.error(`Failed to initialize Redis client: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    handleDisconnect();
    throw error;
  }
};

/**
 * Handle disconnection from Redis
 */
const handleDisconnect = () => {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    
    logger.info(`Attempting to reconnect to Redis (${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    // Schedule reconnection
    setTimeout(async () => {
      try {
        if (!connected) {
          await initialize();
        }
      } catch (error) {
        // Error is already logged in initialize()
      }
    }, reconnectInterval);
  } else {
    logger.error(`Failed to reconnect to Redis after ${maxReconnectAttempts} attempts`);
  }
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
const close = async () => {
  try {
    if (client && connected) {
      await client.quit();
      connected = false;
      logger.info('Closed Redis connection');
    }
  } catch (error) {
    logger.error(`Error closing Redis connection: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null if not found
 */
const get = async (key) => {
  try {
    if (!client || !connected) {
      await initialize();
    }
    
    const value = await client.get(key);
    
    if (value) {
      return JSON.parse(value);
    }
    
    return null;
  } catch (error) {
    logger.error(`Error getting value from cache: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      key
    });
    
    return null;
  }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - True if set successfully
 */
const set = async (key, value, ttl = null) => {
  try {
    if (!client || !connected) {
      await initialize();
    }
    
    const serializedValue = JSON.stringify(value);
    
    if (ttl) {
      await client.set(key, serializedValue, { EX: ttl });
    } else {
      // Use default TTL from environment or 24 hours
      const defaultTtl = parseInt(process.env.REDIS_TTL) || 86400;
      await client.set(key, serializedValue, { EX: defaultTtl });
    }
    
    return true;
  } catch (error) {
    logger.error(`Error setting value in cache: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      key
    });
    
    return false;
  }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - True if deleted successfully
 */
const del = async (key) => {
  try {
    if (!client || !connected) {
      await initialize();
    }
    
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Error deleting value from cache: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      key
    });
    
    return false;
  }
};

/**
 * Clear cache by pattern
 * @param {string} pattern - Key pattern to match
 * @returns {Promise<number>} - Number of keys deleted
 */
const clearByPattern = async (pattern) => {
  try {
    if (!client || !connected) {
      await initialize();
    }
    
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      const result = await client.del(keys);
      logger.info(`Cleared ${result} keys matching pattern: ${pattern}`);
      return result;
    }
    
    return 0;
  } catch (error) {
    logger.error(`Error clearing cache by pattern: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      pattern
    });
    
    return 0;
  }
};

/**
 * Generate cache key
 * @param {string} prefix - Key prefix
 * @param {Object} params - Parameters to include in key
 * @returns {string} - Cache key
 */
const generateKey = (prefix, params = {}) => {
  const keyParts = [prefix];
  
  // Add parameters to key
  Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .forEach(([key, value]) => {
      keyParts.push(`${key}:${value}`);
    });
  
  return keyParts.join(':');
};

module.exports = {
  initialize,
  close,
  get,
  set,
  del,
  clearByPattern,
  generateKey
};
