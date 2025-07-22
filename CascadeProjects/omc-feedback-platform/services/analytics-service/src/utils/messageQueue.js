const amqplib = require('amqplib');
const logger = require('./logger');

// Connection variables
let connection = null;
let channel = null;
let connected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectInterval = 5000; // 5 seconds

/**
 * Connect to RabbitMQ server
 * @returns {Promise<void>}
 */
const connect = async () => {
  try {
    // Get connection URL from environment variables
    const url = process.env.RABBITMQ_URL;
    
    if (!url) {
      throw new Error('RABBITMQ_URL environment variable is not defined');
    }
    
    // Connect to RabbitMQ server
    connection = await amqplib.connect(url);
    
    // Create channel
    channel = await connection.createChannel();
    
    // Assert exchange
    const exchange = process.env.RABBITMQ_EXCHANGE || 'omc_events';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    connected = true;
    
    logger.info('Connected to RabbitMQ server');
    
    // Handle connection close
    connection.on('close', handleDisconnect);
    connection.on('error', handleError);
    
    return { connection, channel };
  } catch (error) {
    logger.error(`Failed to connect to RabbitMQ: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    // Attempt to reconnect
    handleDisconnect();
    
    throw error;
  }
};

/**
 * Handle disconnection from RabbitMQ
 */
const handleDisconnect = () => {
  if (connected) {
    connected = false;
    logger.warn('Disconnected from RabbitMQ server');
  }
  
  // Attempt to reconnect if max attempts not reached
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    
    logger.info(`Attempting to reconnect to RabbitMQ (${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    // Schedule reconnection
    setTimeout(async () => {
      try {
        await connect();
      } catch (error) {
        // Error is already logged in connect()
      }
    }, reconnectInterval);
  } else {
    logger.error(`Failed to reconnect to RabbitMQ after ${maxReconnectAttempts} attempts`);
  }
};

/**
 * Handle RabbitMQ connection error
 * @param {Error} error - Error object
 */
const handleError = (error) => {
  logger.error(`RabbitMQ connection error: ${error.message}`, {
    error: error.message,
    stack: error.stack
  });
  
  // Connection errors will trigger the close event, which will handle reconnection
};

/**
 * Close RabbitMQ connection
 * @returns {Promise<void>}
 */
const close = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    
    if (connection) {
      await connection.close();
    }
    
    connected = false;
    logger.info('Closed RabbitMQ connection');
  } catch (error) {
    logger.error(`Error closing RabbitMQ connection: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Publish message to RabbitMQ exchange
 * @param {string} routingKey - Routing key
 * @param {Object} message - Message to publish
 * @param {Object} options - Publishing options
 * @returns {Promise<boolean>} - True if published successfully
 */
const publish = async (routingKey, message, options = {}) => {
  try {
    if (!connected || !channel) {
      await connect();
    }
    
    const exchange = process.env.RABBITMQ_EXCHANGE || 'omc_events';
    const content = Buffer.from(JSON.stringify(message));
    
    // Default options
    const defaultOptions = {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now()
    };
    
    // Merge default options with provided options
    const publishOptions = { ...defaultOptions, ...options };
    
    // Publish message
    const result = channel.publish(exchange, routingKey, content, publishOptions);
    
    if (result) {
      logger.debug(`Published message to ${exchange} with routing key ${routingKey}`, {
        routingKey,
        exchange
      });
    } else {
      logger.warn(`Failed to publish message to ${exchange} with routing key ${routingKey}`, {
        routingKey,
        exchange
      });
    }
    
    return result;
  } catch (error) {
    logger.error(`Error publishing message to RabbitMQ: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      routingKey
    });
    
    return false;
  }
};

/**
 * Setup consumer for RabbitMQ queue
 * @param {string} queueName - Queue name
 * @param {Array<string>} routingKeys - Array of routing keys to bind
 * @param {Function} handler - Message handler function
 * @returns {Promise<Object>} - Queue information
 */
const setupConsumer = async (queueName, routingKeys, handler) => {
  try {
    if (!connected || !channel) {
      await connect();
    }
    
    const exchange = process.env.RABBITMQ_EXCHANGE || 'omc_events';
    
    // Assert queue
    const queue = await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 1000 * 60 * 60 * 24, // 24 hours
        'x-dead-letter-exchange': `${exchange}.dead-letter`
      }
    });
    
    // Bind queue to exchange with routing keys
    for (const routingKey of routingKeys) {
      await channel.bindQueue(queue.queue, exchange, routingKey);
      logger.debug(`Bound queue ${queueName} to exchange ${exchange} with routing key ${routingKey}`);
    }
    
    // Set prefetch count to avoid overwhelming the consumer
    await channel.prefetch(10);
    
    // Setup consumer
    await channel.consume(queue.queue, async (msg) => {
      if (!msg) {
        return;
      }
      
      try {
        // Parse message content
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        
        // Process message
        await handler(content, routingKey);
        
        // Acknowledge message
        channel.ack(msg);
      } catch (error) {
        logger.error(`Error processing message: ${error.message}`, {
          error: error.message,
          stack: error.stack,
          routingKey: msg.fields.routingKey
        });
        
        // Reject message and requeue if it's not a parsing error
        const requeue = !error.message.includes('JSON');
        channel.reject(msg, requeue);
      }
    });
    
    logger.info(`Consumer setup for queue ${queueName} with ${routingKeys.length} routing keys`);
    
    return queue;
  } catch (error) {
    logger.error(`Error setting up consumer: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      queueName,
      routingKeys
    });
    
    throw error;
  }
};

module.exports = {
  connect,
  close,
  publish,
  setupConsumer
};
