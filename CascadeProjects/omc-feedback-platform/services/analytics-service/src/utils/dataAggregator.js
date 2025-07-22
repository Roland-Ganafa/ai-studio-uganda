const mongoose = require('mongoose');
const moment = require('moment');
const logger = require('./logger');
const AnalyticsEvent = require('../models/analyticsEvent');
const FeedbackMetrics = require('../models/feedbackMetrics');
const UserMetrics = require('../models/userMetrics');

/**
 * Data aggregation utility for analytics
 * Processes raw events and generates aggregated metrics
 */
class DataAggregator {
  /**
   * Aggregate feedback metrics for a specific period
   * @param {string} period - Period type (daily, weekly, monthly, quarterly, yearly)
   * @param {Date} date - Date for the period
   * @param {mongoose.Types.ObjectId} companyId - Company ID (optional)
   * @returns {Promise<Object>} - Aggregated metrics
   */
  static async aggregateFeedbackMetrics(period, date, companyId = null) {
    try {
      logger.info(`Aggregating feedback metrics for ${period} period at ${date.toISOString()}`, {
        period,
        date: date.toISOString(),
        companyId: companyId?.toString()
      });
      
      // Calculate period start and end dates
      const { startDate, endDate } = this._calculatePeriodDates(period, date);
      
      // Build match criteria for aggregation
      const matchCriteria = {
        sourceService: 'feedback',
        timestamp: {
          $gte: startDate,
          $lt: endDate
        }
      };
      
      if (companyId) {
        matchCriteria.companyId = new mongoose.Types.ObjectId(companyId);
      }
      
      // Aggregate feedback counts by status
      const statusCounts = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: { $in: ['feedback.created', 'feedback.updated', 'feedback.resolved', 'feedback.closed'] } } },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate feedback counts by priority
      const priorityCounts = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.created' } },
        {
          $group: {
            _id: '$eventData.priority',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate feedback counts by category
      const categoryCounts = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.created' } },
        {
          $group: {
            _id: '$eventData.categoryId',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate response times
      const responseTimes = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.responded' } },
        {
          $project: {
            responseTime: { $subtract: ['$timestamp', '$eventData.createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$responseTime' },
            min: { $min: '$responseTime' },
            max: { $max: '$responseTime' },
            values: { $push: '$responseTime' }
          }
        }
      ]);
      
      // Aggregate resolution times
      const resolutionTimes = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.resolved' } },
        {
          $project: {
            resolutionTime: { $subtract: ['$timestamp', '$eventData.createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$resolutionTime' },
            min: { $min: '$resolutionTime' },
            max: { $max: '$resolutionTime' },
            values: { $push: '$resolutionTime' }
          }
        }
      ]);
      
      // Aggregate satisfaction scores
      const satisfactionScores = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.satisfaction' } },
        {
          $group: {
            _id: null,
            average: { $avg: '$eventData.score' },
            count: { $sum: 1 },
            scores: { $push: '$eventData.score' }
          }
        }
      ]);
      
      // Aggregate escalation data
      const escalationData = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.escalated' } },
        {
          $group: {
            _id: '$eventData.escalationLevel',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate comment data
      const commentData = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'feedback.commented' } },
        {
          $group: {
            _id: '$eventData.commentType',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Process and format the aggregated data
      const metrics = this._processFeedbackMetrics(
        statusCounts,
        priorityCounts,
        categoryCounts,
        responseTimes,
        resolutionTimes,
        satisfactionScores,
        escalationData,
        commentData
      );
      
      // Create or update metrics in the database
      const query = {
        period,
        date: startDate,
        companyId: companyId || null
      };
      
      const update = {
        $set: {
          ...metrics,
          calculatedAt: new Date()
        }
      };
      
      const options = {
        upsert: true,
        new: true
      };
      
      const feedbackMetrics = await FeedbackMetrics.findOneAndUpdate(query, update, options);
      
      logger.info(`Successfully aggregated feedback metrics for ${period} period`, {
        period,
        date: date.toISOString(),
        companyId: companyId?.toString(),
        metricsId: feedbackMetrics._id.toString()
      });
      
      return feedbackMetrics;
    } catch (error) {
      logger.error(`Error aggregating feedback metrics: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        period,
        date: date.toISOString(),
        companyId: companyId?.toString()
      });
      
      throw error;
    }
  }
  
  /**
   * Aggregate user metrics for a specific period
   * @param {string} period - Period type (daily, weekly, monthly, quarterly, yearly)
   * @param {Date} date - Date for the period
   * @param {mongoose.Types.ObjectId} companyId - Company ID (optional)
   * @returns {Promise<Object>} - Aggregated metrics
   */
  static async aggregateUserMetrics(period, date, companyId = null) {
    try {
      logger.info(`Aggregating user metrics for ${period} period at ${date.toISOString()}`, {
        period,
        date: date.toISOString(),
        companyId: companyId?.toString()
      });
      
      // Calculate period start and end dates
      const { startDate, endDate } = this._calculatePeriodDates(period, date);
      
      // Build match criteria for aggregation
      const matchCriteria = {
        sourceService: 'user',
        timestamp: {
          $gte: startDate,
          $lt: endDate
        }
      };
      
      if (companyId) {
        matchCriteria.companyId = new mongoose.Types.ObjectId(companyId);
      }
      
      // Aggregate user counts
      const userCounts = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: { $in: ['user.created', 'user.login', 'user.active'] } } },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate user counts by role
      const roleCounts = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'user.created' } },
        {
          $group: {
            _id: '$eventData.role',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Aggregate login activity
      const loginActivity = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        { $match: { eventType: 'user.login' } },
        {
          $group: {
            _id: '$userId',
            loginCount: { $sum: 1 },
            sessionDurations: { $push: '$eventData.sessionDuration' }
          }
        },
        {
          $group: {
            _id: null,
            uniqueUsers: { $sum: 1 },
            totalLogins: { $sum: '$loginCount' },
            sessionDurations: { $push: '$sessionDurations' }
          }
        }
      ]);
      
      // Aggregate user engagement
      const userEngagement = await AnalyticsEvent.aggregate([
        { $match: matchCriteria },
        {
          $match: {
            eventType: {
              $in: [
                'feedback.created',
                'feedback.commented',
                'feedback.responded',
                'feedback.resolved'
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              eventType: '$eventType'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.eventType',
            uniqueUsers: { $sum: 1 },
            totalCount: { $sum: '$count' }
          }
        }
      ]);
      
      // Aggregate notification metrics
      const notificationMetrics = await AnalyticsEvent.aggregate([
        { $match: { ...matchCriteria, sourceService: 'notification' } },
        {
          $match: {
            eventType: {
              $in: [
                'notification.sent',
                'notification.read',
                'notification.delivered'
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              eventType: '$eventType',
              channel: '$eventData.channel'
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Process and format the aggregated data
      const metrics = this._processUserMetrics(
        userCounts,
        roleCounts,
        loginActivity,
        userEngagement,
        notificationMetrics
      );
      
      // Create or update metrics in the database
      const query = {
        period,
        date: startDate,
        companyId: companyId || null
      };
      
      const update = {
        $set: {
          ...metrics,
          calculatedAt: new Date()
        }
      };
      
      const options = {
        upsert: true,
        new: true
      };
      
      const userMetrics = await UserMetrics.findOneAndUpdate(query, update, options);
      
      logger.info(`Successfully aggregated user metrics for ${period} period`, {
        period,
        date: date.toISOString(),
        companyId: companyId?.toString(),
        metricsId: userMetrics._id.toString()
      });
      
      return userMetrics;
    } catch (error) {
      logger.error(`Error aggregating user metrics: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        period,
        date: date.toISOString(),
        companyId: companyId?.toString()
      });
      
      throw error;
    }
  }
  
  /**
   * Run scheduled aggregations for all periods
   * @param {string} periodType - Period type to aggregate (daily, weekly, monthly)
   * @returns {Promise<void>}
   */
  static async runScheduledAggregation(periodType) {
    try {
      logger.info(`Running scheduled ${periodType} aggregation`);
      
      const date = new Date();
      
      // Get all companies
      const companies = await mongoose.connection.db.collection('companies').find({}, { _id: 1 }).toArray();
      
      // Run platform-wide aggregation
      await this.aggregateFeedbackMetrics(periodType, date);
      await this.aggregateUserMetrics(periodType, date);
      
      // Run company-specific aggregations
      for (const company of companies) {
        await this.aggregateFeedbackMetrics(periodType, date, company._id);
        await this.aggregateUserMetrics(periodType, date, company._id);
      }
      
      logger.info(`Completed scheduled ${periodType} aggregation`);
    } catch (error) {
      logger.error(`Error running scheduled ${periodType} aggregation: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Calculate start and end dates for a period
   * @param {string} period - Period type (daily, weekly, monthly, quarterly, yearly)
   * @param {Date} date - Reference date
   * @returns {Object} - Start and end dates
   * @private
   */
  static _calculatePeriodDates(period, date) {
    const momentDate = moment(date);
    let startDate, endDate;
    
    switch (period) {
      case 'daily':
        startDate = momentDate.clone().startOf('day').toDate();
        endDate = momentDate.clone().endOf('day').toDate();
        break;
      case 'weekly':
        startDate = momentDate.clone().startOf('week').toDate();
        endDate = momentDate.clone().endOf('week').toDate();
        break;
      case 'monthly':
        startDate = momentDate.clone().startOf('month').toDate();
        endDate = momentDate.clone().endOf('month').toDate();
        break;
      case 'quarterly':
        startDate = momentDate.clone().startOf('quarter').toDate();
        endDate = momentDate.clone().endOf('quarter').toDate();
        break;
      case 'yearly':
        startDate = momentDate.clone().startOf('year').toDate();
        endDate = momentDate.clone().endOf('year').toDate();
        break;
      case 'all_time':
        startDate = new Date(0); // Unix epoch
        endDate = new Date();
        break;
      default:
        throw new Error(`Invalid period: ${period}`);
    }
    
    return { startDate, endDate };
  }
  
  /**
   * Process feedback metrics data
   * @param {Array} statusCounts - Status counts
   * @param {Array} priorityCounts - Priority counts
   * @param {Array} categoryCounts - Category counts
   * @param {Array} responseTimes - Response times
   * @param {Array} resolutionTimes - Resolution times
   * @param {Array} satisfactionScores - Satisfaction scores
   * @param {Array} escalationData - Escalation data
   * @param {Array} commentData - Comment data
   * @returns {Object} - Processed metrics
   * @private
   */
  static _processFeedbackMetrics(
    statusCounts,
    priorityCounts,
    categoryCounts,
    responseTimes,
    resolutionTimes,
    satisfactionScores,
    escalationData,
    commentData
  ) {
    // Process status counts
    const counts = {
      total: 0,
      new: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0
    };
    
    statusCounts.forEach(item => {
      if (item._id === 'feedback.created') {
        counts.total = item.count;
        counts.new = item.count;
      } else if (item._id === 'feedback.updated' && item.eventData?.status === 'in_progress') {
        counts.inProgress = item.count;
      } else if (item._id === 'feedback.resolved') {
        counts.resolved = item.count;
      } else if (item._id === 'feedback.closed') {
        counts.closed = item.count;
      }
    });
    
    // Process priority counts
    const byPriority = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    priorityCounts.forEach(item => {
      if (item._id && byPriority.hasOwnProperty(item._id)) {
        byPriority[item._id] = item.count;
      }
    });
    
    // Process category counts
    const byCategory = {};
    
    categoryCounts.forEach(item => {
      if (item._id) {
        byCategory[item._id.toString()] = item.count;
      }
    });
    
    // Process response times
    const responseTimeMetrics = {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      percentile95: 0
    };
    
    if (responseTimes.length > 0 && responseTimes[0].values) {
      const values = responseTimes[0].values.sort((a, b) => a - b);
      responseTimeMetrics.average = responseTimes[0].average || 0;
      responseTimeMetrics.min = responseTimes[0].min || 0;
      responseTimeMetrics.max = responseTimes[0].max || 0;
      
      // Calculate median
      const mid = Math.floor(values.length / 2);
      responseTimeMetrics.median = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
      
      // Calculate 95th percentile
      const p95Index = Math.ceil(values.length * 0.95) - 1;
      responseTimeMetrics.percentile95 = values[p95Index] || 0;
    }
    
    // Process resolution times
    const resolutionTimeMetrics = {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      percentile95: 0
    };
    
    if (resolutionTimes.length > 0 && resolutionTimes[0].values) {
      const values = resolutionTimes[0].values.sort((a, b) => a - b);
      resolutionTimeMetrics.average = resolutionTimes[0].average || 0;
      resolutionTimeMetrics.min = resolutionTimes[0].min || 0;
      resolutionTimeMetrics.max = resolutionTimes[0].max || 0;
      
      // Calculate median
      const mid = Math.floor(values.length / 2);
      resolutionTimeMetrics.median = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
      
      // Calculate 95th percentile
      const p95Index = Math.ceil(values.length * 0.95) - 1;
      resolutionTimeMetrics.percentile95 = values[p95Index] || 0;
    }
    
    // Process satisfaction scores
    const satisfaction = {
      average: 0,
      count: 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      }
    };
    
    if (satisfactionScores.length > 0) {
      satisfaction.average = satisfactionScores[0].average || 0;
      satisfaction.count = satisfactionScores[0].count || 0;
      
      // Calculate distribution
      if (satisfactionScores[0].scores) {
        satisfactionScores[0].scores.forEach(score => {
          if (satisfaction.distribution.hasOwnProperty(score)) {
            satisfaction.distribution[score]++;
          }
        });
      }
    }
    
    // Process escalation data
    const escalations = {
      count: 0,
      percentage: 0,
      byLevel: {
        1: 0,
        2: 0,
        3: 0
      }
    };
    
    escalationData.forEach(item => {
      escalations.count += item.count;
      
      if (item._id && escalations.byLevel.hasOwnProperty(item._id)) {
        escalations.byLevel[item._id] = item.count;
      }
    });
    
    // Calculate escalation percentage
    if (counts.total > 0) {
      escalations.percentage = (escalations.count / counts.total) * 100;
    }
    
    // Process comment data
    const comments = {
      total: 0,
      average: 0,
      internal: 0,
      external: 0
    };
    
    commentData.forEach(item => {
      comments.total += item.count;
      
      if (item._id === 'internal') {
        comments.internal = item.count;
      } else if (item._id === 'external') {
        comments.external = item.count;
      }
    });
    
    // Calculate average comments per feedback
    if (counts.total > 0) {
      comments.average = comments.total / counts.total;
    }
    
    return {
      counts,
      byPriority,
      byCategory,
      responseTimes: responseTimeMetrics,
      resolutionTimes: resolutionTimeMetrics,
      satisfaction,
      escalations,
      comments
    };
  }
  
  /**
   * Process user metrics data
   * @param {Array} userCounts - User counts
   * @param {Array} roleCounts - Role counts
   * @param {Array} loginActivity - Login activity
   * @param {Array} userEngagement - User engagement
   * @param {Array} notificationMetrics - Notification metrics
   * @returns {Object} - Processed metrics
   * @private
   */
  static _processUserMetrics(
    userCounts,
    roleCounts,
    loginActivity,
    userEngagement,
    notificationMetrics
  ) {
    // Process user counts
    const counts = {
      total: 0,
      active: 0,
      new: 0
    };
    
    userCounts.forEach(item => {
      if (item._id === 'user.created') {
        counts.new = item.count;
      } else if (item._id === 'user.active') {
        counts.active = item.count;
      }
    });
    
    // Get total users from the database (this would be a separate query)
    // For now, we'll estimate based on new users
    counts.total = counts.new * 10; // Placeholder
    
    // Process role counts
    const byRole = {
      admin: 0,
      manager: 0,
      agent: 0,
      customer: 0
    };
    
    roleCounts.forEach(item => {
      if (item._id && byRole.hasOwnProperty(item._id)) {
        byRole[item._id] = item.count;
      }
    });
    
    // Process login activity
    const activity = {
      averageLogins: 0,
      averageSessionDuration: 0,
      totalSessions: 0,
      totalLogins: 0
    };
    
    if (loginActivity.length > 0) {
      const data = loginActivity[0];
      activity.totalLogins = data.totalLogins || 0;
      activity.totalSessions = data.uniqueUsers || 0;
      
      // Calculate average logins per user
      if (data.uniqueUsers > 0) {
        activity.averageLogins = data.totalLogins / data.uniqueUsers;
      }
      
      // Calculate average session duration
      if (data.sessionDurations && data.sessionDurations.length > 0) {
        const durations = data.sessionDurations.flat();
        activity.averageSessionDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      }
    }
    
    // Process user engagement
    const engagement = {
      averageFeedbackSubmissions: 0,
      averageComments: 0,
      averageResponses: 0,
      averageResolutionTime: 0
    };
    
    userEngagement.forEach(item => {
      if (item._id === 'feedback.created' && item.uniqueUsers > 0) {
        engagement.averageFeedbackSubmissions = item.totalCount / item.uniqueUsers;
      } else if (item._id === 'feedback.commented' && item.uniqueUsers > 0) {
        engagement.averageComments = item.totalCount / item.uniqueUsers;
      } else if (item._id === 'feedback.responded' && item.uniqueUsers > 0) {
        engagement.averageResponses = item.totalCount / item.uniqueUsers;
      }
    });
    
    // Process notification metrics
    const notifications = {
      sent: 0,
      read: 0,
      readRate: 0,
      byChannel: {
        email: {
          sent: 0,
          delivered: 0,
          opened: 0
        },
        sms: {
          sent: 0,
          delivered: 0
        },
        push: {
          sent: 0,
          delivered: 0,
          opened: 0
        },
        inApp: {
          sent: 0,
          read: 0
        }
      }
    };
    
    notificationMetrics.forEach(item => {
      const { eventType, channel } = item._id;
      
      if (eventType === 'notification.sent') {
        notifications.sent += item.count;
        
        if (channel && notifications.byChannel[channel]) {
          notifications.byChannel[channel].sent = item.count;
        }
      } else if (eventType === 'notification.read') {
        notifications.read += item.count;
        
        if (channel === 'inApp') {
          notifications.byChannel.inApp.read = item.count;
        }
      } else if (eventType === 'notification.delivered') {
        if (channel === 'email') {
          notifications.byChannel.email.delivered = item.count;
        } else if (channel === 'sms') {
          notifications.byChannel.sms.delivered = item.count;
        } else if (channel === 'push') {
          notifications.byChannel.push.delivered = item.count;
        }
      }
    });
    
    // Calculate read rate
    if (notifications.sent > 0) {
      notifications.readRate = (notifications.read / notifications.sent) * 100;
    }
    
    // Placeholder for performance metrics (would require more complex queries)
    const performance = {
      averageFeedbackHandled: 0,
      averageResolutionRate: 0,
      averageSatisfactionScore: 0,
      averageResponseTime: 0
    };
    
    return {
      counts,
      byRole,
      activity,
      engagement,
      performance,
      notifications
    };
  }
}

module.exports = DataAggregator;
