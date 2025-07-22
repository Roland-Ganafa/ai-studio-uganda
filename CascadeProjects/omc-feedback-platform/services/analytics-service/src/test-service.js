/**
 * Test script for Analytics Service
 * This script simulates events and tests the API endpoints
 */

const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Models
const AnalyticsEvent = require('./models/analyticsEvent');
const FeedbackMetrics = require('./models/feedbackMetrics');
const UserMetrics = require('./models/userMetrics');
const Dashboard = require('./models/dashboard');

// Base URL for API
const API_BASE_URL = `http://localhost:${process.env.PORT || 3003}/api`;

// Sample JWT token for testing (would normally come from authentication)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTYiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJyb2xlcyI6WyJhZG1pbiJdLCJjb21wYW55SWQiOiJjb21wYW55MTIzIiwiaWF0IjoxNjI1MDYyNDAwfQ.tYmjzQuZhY5HFHX_YRG1hKBzxkMxR-c1yo-rY5xA_Ys';

// API client with authentication
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_TOKEN}`
  }
});

/**
 * Generate sample analytics events
 */
async function generateSampleEvents() {
  console.log('Generating sample analytics events...');
  
  // Sample feedback events
  const feedbackEvents = [
    {
      sourceService: 'feedback-service',
      eventType: 'feedback.created',
      eventData: {
        feedbackId: 'f1',
        title: 'App crashes on startup',
        description: 'The mobile app crashes immediately after launch',
        category: 'bug',
        priority: 'high',
        status: 'new'
      },
      userId: 'user1',
      companyId: 'company1',
      resourceId: 'f1',
      resourceType: 'feedback',
      metadata: {
        platform: 'iOS',
        version: '2.1.0'
      }
    },
    {
      sourceService: 'feedback-service',
      eventType: 'feedback.updated',
      eventData: {
        feedbackId: 'f1',
        status: 'in_progress',
        assignedTo: 'user2'
      },
      userId: 'user2',
      companyId: 'company1',
      resourceId: 'f1',
      resourceType: 'feedback'
    },
    {
      sourceService: 'feedback-service',
      eventType: 'feedback.resolved',
      eventData: {
        feedbackId: 'f1',
        resolution: 'Fixed in version 2.1.1',
        satisfactionScore: 4
      },
      userId: 'user2',
      companyId: 'company1',
      resourceId: 'f1',
      resourceType: 'feedback'
    }
  ];
  
  // Sample user events
  const userEvents = [
    {
      sourceService: 'user-service',
      eventType: 'user.registered',
      eventData: {
        userId: 'user3',
        email: 'new@example.com',
        role: 'customer'
      },
      userId: 'user3',
      companyId: 'company1',
      resourceId: 'user3',
      resourceType: 'user'
    },
    {
      sourceService: 'user-service',
      eventType: 'user.login',
      eventData: {
        userId: 'user1',
        timestamp: new Date()
      },
      userId: 'user1',
      companyId: 'company1',
      resourceId: 'user1',
      resourceType: 'user'
    }
  ];
  
  // Sample notification events
  const notificationEvents = [
    {
      sourceService: 'notification-service',
      eventType: 'notification.sent',
      eventData: {
        notificationId: 'n1',
        template: 'feedback_assigned',
        channel: 'email'
      },
      userId: 'user2',
      companyId: 'company1',
      resourceId: 'n1',
      resourceType: 'notification'
    },
    {
      sourceService: 'notification-service',
      eventType: 'notification.read',
      eventData: {
        notificationId: 'n1',
        readAt: new Date()
      },
      userId: 'user2',
      companyId: 'company1',
      resourceId: 'n1',
      resourceType: 'notification'
    }
  ];
  
  // Combine all events
  const allEvents = [...feedbackEvents, ...userEvents, ...notificationEvents];
  
  try {
    // Create events via API
    const response = await apiClient.post('/events/batch', { events: allEvents });
    console.log(`Created ${response.data.data.insertedCount} sample events`);
    return response.data;
  } catch (error) {
    console.error('Error creating sample events:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a sample dashboard
 */
async function createSampleDashboard() {
  console.log('Creating sample dashboard...');
  
  const dashboard = {
    name: 'Feedback Overview',
    description: 'Overview of feedback metrics and trends',
    layout: {
      columns: 12,
      rows: 10
    },
    widgets: [
      {
        id: 'w1',
        type: 'chart',
        title: 'Feedback by Category',
        config: {
          chartType: 'pie',
          dataSource: 'feedback_categories',
          period: 'monthly'
        },
        position: {
          x: 0,
          y: 0,
          w: 6,
          h: 4
        }
      },
      {
        id: 'w2',
        type: 'chart',
        title: 'Resolution Time Trend',
        config: {
          chartType: 'line',
          dataSource: 'resolution_time',
          period: 'weekly'
        },
        position: {
          x: 6,
          y: 0,
          w: 6,
          h: 4
        }
      },
      {
        id: 'w3',
        type: 'metric',
        title: 'Open Feedback',
        config: {
          metricType: 'count',
          dataSource: 'open_feedback'
        },
        position: {
          x: 0,
          y: 4,
          w: 3,
          h: 2
        }
      },
      {
        id: 'w4',
        type: 'metric',
        title: 'Avg. Satisfaction',
        config: {
          metricType: 'average',
          dataSource: 'satisfaction_score'
        },
        position: {
          x: 3,
          y: 4,
          w: 3,
          h: 2
        }
      }
    ],
    filters: [
      {
        id: 'f1',
        type: 'date',
        field: 'date',
        operator: 'range',
        value: {
          start: 'last-30-days',
          end: 'today'
        }
      },
      {
        id: 'f2',
        type: 'select',
        field: 'category',
        operator: 'in',
        value: []
      }
    ],
    isDefault: true
  };
  
  try {
    const response = await apiClient.post('/dashboards', dashboard);
    console.log('Sample dashboard created:', response.data.data._id);
    return response.data;
  } catch (error) {
    console.error('Error creating sample dashboard:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Trigger metrics aggregation
 */
async function triggerAggregation() {
  console.log('Triggering metrics aggregation...');
  
  try {
    const response = await apiClient.post('/metrics/aggregate', {
      period: 'daily'
    });
    console.log('Aggregation triggered:', response.data.message);
    return response.data;
  } catch (error) {
    console.error('Error triggering aggregation:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get metrics summary
 */
async function getMetricsSummary() {
  console.log('Getting metrics summary...');
  
  try {
    const response = await apiClient.get('/metrics/summary');
    console.log('Metrics summary:', JSON.stringify(response.data.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error getting metrics summary:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Run the test script
 */
async function runTest() {
  try {
    console.log('Starting Analytics Service test...');
    
    // Generate sample events
    await generateSampleEvents();
    
    // Create sample dashboard
    await createSampleDashboard();
    
    // Trigger metrics aggregation
    await triggerAggregation();
    
    // Wait for aggregation to complete
    console.log('Waiting for aggregation to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get metrics summary
    await getMetricsSummary();
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Disconnect from MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Disconnected from MongoDB');
    }
    
    process.exit(0);
  }
}

// Run the test
runTest();
