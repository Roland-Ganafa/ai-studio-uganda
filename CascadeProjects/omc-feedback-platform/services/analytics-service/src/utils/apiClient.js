const axios = require('axios');
const logger = require('./logger');
const cache = require('./cache');

/**
 * API Client for communicating with other services
 */
class ApiClient {
  /**
   * Create a new API client instance
   * @param {string} baseUrl - Base URL for the service
   * @param {string} serviceName - Service name for logging
   * @param {Object} options - Additional options
   */
  constructor(baseUrl, serviceName, options = {}) {
    this.baseUrl = baseUrl;
    this.serviceName = serviceName;
    this.options = {
      timeout: 10000, // 10 seconds
      useCache: true,
      cacheTtl: 300, // 5 minutes
      ...options
    };
    
    // Create axios instance
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: this.options.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`${this.serviceName} API request: ${config.method.toUpperCase()} ${config.url}`, {
          service: this.serviceName,
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error(`${this.serviceName} API request error: ${error.message}`, {
          service: this.serviceName,
          error: error.message,
          stack: error.stack
        });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`${this.serviceName} API response: ${response.status}`, {
          service: this.serviceName,
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`${this.serviceName} API error response: ${error.response.status}`, {
            service: this.serviceName,
            status: error.response.status,
            data: error.response.data,
            url: error.config.url
          });
        } else if (error.request) {
          logger.error(`${this.serviceName} API no response: ${error.message}`, {
            service: this.serviceName,
            error: error.message,
            url: error.config.url
          });
        } else {
          logger.error(`${this.serviceName} API error: ${error.message}`, {
            service: this.serviceName,
            error: error.message,
            stack: error.stack
          });
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Set authentication token for requests
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async get(endpoint, params = {}, options = {}) {
    const useCache = options.useCache !== undefined ? options.useCache : this.options.useCache;
    const cacheTtl = options.cacheTtl || this.options.cacheTtl;
    
    // Generate cache key
    const cacheKey = useCache ? cache.generateKey(
      `api:${this.serviceName}:${endpoint}`,
      params
    ) : null;
    
    // Try to get from cache first
    if (useCache) {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for ${this.serviceName} API: ${endpoint}`, {
          service: this.serviceName,
          endpoint,
          cacheKey
        });
        return cachedData;
      }
    }
    
    // Make API request
    try {
      const response = await this.client.get(endpoint, { params });
      
      // Cache response if enabled
      if (useCache && response.data) {
        await cache.set(cacheKey, response.data, cacheTtl);
      }
      
      return response.data;
    } catch (error) {
      // Throw custom error with service name
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`${this.serviceName} API error: ${errorMessage}`);
    }
  }
  
  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async post(endpoint, data = {}, options = {}) {
    try {
      const response = await this.client.post(endpoint, data);
      
      // Invalidate cache for this endpoint if needed
      if (options.invalidateCache) {
        await cache.clearByPattern(`api:${this.serviceName}:${endpoint}*`);
      }
      
      return response.data;
    } catch (error) {
      // Throw custom error with service name
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`${this.serviceName} API error: ${errorMessage}`);
    }
  }
  
  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async put(endpoint, data = {}, options = {}) {
    try {
      const response = await this.client.put(endpoint, data);
      
      // Invalidate cache for this endpoint if needed
      if (options.invalidateCache) {
        await cache.clearByPattern(`api:${this.serviceName}:${endpoint}*`);
      }
      
      return response.data;
    } catch (error) {
      // Throw custom error with service name
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`${this.serviceName} API error: ${errorMessage}`);
    }
  }
  
  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async delete(endpoint, params = {}, options = {}) {
    try {
      const response = await this.client.delete(endpoint, { params });
      
      // Invalidate cache for this endpoint if needed
      if (options.invalidateCache) {
        await cache.clearByPattern(`api:${this.serviceName}:${endpoint}*`);
      }
      
      return response.data;
    } catch (error) {
      // Throw custom error with service name
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`${this.serviceName} API error: ${errorMessage}`);
    }
  }
}

// Create API clients for each service
const feedbackServiceClient = new ApiClient(
  process.env.FEEDBACK_SERVICE_URL,
  'feedback-service'
);

const userServiceClient = new ApiClient(
  process.env.USER_SERVICE_URL,
  'user-service'
);

const notificationServiceClient = new ApiClient(
  process.env.NOTIFICATION_SERVICE_URL,
  'notification-service'
);

module.exports = {
  ApiClient,
  feedbackServiceClient,
  userServiceClient,
  notificationServiceClient
};
