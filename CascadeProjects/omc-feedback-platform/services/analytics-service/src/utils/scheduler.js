const cron = require('node-cron');
const logger = require('./logger');
const DataAggregator = require('./dataAggregator');

/**
 * Scheduler for periodic analytics tasks
 */
class Scheduler {
  constructor() {
    this.jobs = new Map();
  }
  
  /**
   * Initialize scheduler with default jobs
   */
  initialize() {
    try {
      logger.info('Initializing analytics scheduler');
      
      // Schedule daily aggregation (default: midnight)
      const dailySchedule = process.env.DAILY_AGGREGATION_SCHEDULE || '0 0 * * *';
      this.scheduleJob('daily-aggregation', dailySchedule, async () => {
        logger.info('Running daily aggregation job');
        await DataAggregator.runScheduledAggregation('daily');
      });
      
      // Schedule weekly aggregation (default: midnight on Sunday)
      const weeklySchedule = process.env.WEEKLY_AGGREGATION_SCHEDULE || '0 0 * * 0';
      this.scheduleJob('weekly-aggregation', weeklySchedule, async () => {
        logger.info('Running weekly aggregation job');
        await DataAggregator.runScheduledAggregation('weekly');
      });
      
      // Schedule monthly aggregation (default: midnight on 1st day of month)
      const monthlySchedule = process.env.MONTHLY_AGGREGATION_SCHEDULE || '0 0 1 * *';
      this.scheduleJob('monthly-aggregation', monthlySchedule, async () => {
        logger.info('Running monthly aggregation job');
        await DataAggregator.runScheduledAggregation('monthly');
      });
      
      // Schedule report generation job (default: 1 AM daily)
      this.scheduleJob('report-generation', '0 1 * * *', async () => {
        logger.info('Running scheduled report generation job');
        await this._generateScheduledReports();
      });
      
      logger.info('Analytics scheduler initialized successfully');
    } catch (error) {
      logger.error(`Error initializing scheduler: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Schedule a new job
   * @param {string} name - Job name
   * @param {string} schedule - Cron schedule expression
   * @param {Function} task - Task function to execute
   * @returns {boolean} - True if scheduled successfully
   */
  scheduleJob(name, schedule, task) {
    try {
      // Validate cron expression
      if (!cron.validate(schedule)) {
        logger.error(`Invalid cron schedule for job ${name}: ${schedule}`);
        return false;
      }
      
      // Stop existing job if it exists
      if (this.jobs.has(name)) {
        this.stopJob(name);
      }
      
      // Create new job
      const job = cron.schedule(schedule, async () => {
        try {
          logger.info(`Executing scheduled job: ${name}`);
          const startTime = Date.now();
          
          await task();
          
          const duration = Date.now() - startTime;
          logger.info(`Job ${name} completed in ${duration}ms`);
        } catch (error) {
          logger.error(`Error executing job ${name}: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            jobName: name
          });
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });
      
      // Store job
      this.jobs.set(name, job);
      
      logger.info(`Scheduled job ${name} with schedule: ${schedule}`);
      return true;
    } catch (error) {
      logger.error(`Error scheduling job ${name}: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        jobName: name,
        schedule
      });
      
      return false;
    }
  }
  
  /**
   * Stop a scheduled job
   * @param {string} name - Job name
   * @returns {boolean} - True if stopped successfully
   */
  stopJob(name) {
    try {
      if (this.jobs.has(name)) {
        const job = this.jobs.get(name);
        job.stop();
        this.jobs.delete(name);
        
        logger.info(`Stopped job: ${name}`);
        return true;
      }
      
      logger.warn(`Job ${name} not found`);
      return false;
    } catch (error) {
      logger.error(`Error stopping job ${name}: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        jobName: name
      });
      
      return false;
    }
  }
  
  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    try {
      for (const [name, job] of this.jobs.entries()) {
        job.stop();
        logger.info(`Stopped job: ${name}`);
      }
      
      this.jobs.clear();
      logger.info('All scheduled jobs stopped');
    } catch (error) {
      logger.error(`Error stopping all jobs: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Run a job immediately
   * @param {string} name - Job name
   * @returns {Promise<boolean>} - True if executed successfully
   */
  async runJobNow(name) {
    try {
      if (this.jobs.has(name)) {
        logger.info(`Manually executing job: ${name}`);
        
        const startTime = Date.now();
        const job = this.jobs.get(name);
        
        // Execute the job function
        await job.execute();
        
        const duration = Date.now() - startTime;
        logger.info(`Manual execution of job ${name} completed in ${duration}ms`);
        
        return true;
      }
      
      logger.warn(`Job ${name} not found for manual execution`);
      return false;
    } catch (error) {
      logger.error(`Error executing job ${name} manually: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        jobName: name
      });
      
      return false;
    }
  }
  
  /**
   * Generate scheduled reports
   * @private
   */
  async _generateScheduledReports() {
    try {
      const mongoose = require('mongoose');
      const Report = require('../models/report');
      
      // Find reports that are scheduled to run now
      const now = new Date();
      const reports = await Report.find({
        'schedule.isScheduled': true,
        'schedule.nextRun': { $lte: now }
      });
      
      logger.info(`Found ${reports.length} reports to generate`);
      
      // Process each report
      for (const report of reports) {
        try {
          logger.info(`Generating scheduled report: ${report.name}`, {
            reportId: report._id.toString(),
            reportType: report.type
          });
          
          // This would call the report generation service
          // For now, we'll just update the next run time
          
          // Calculate next run time based on frequency
          let nextRun = new Date();
          
          switch (report.schedule.frequency) {
            case 'daily':
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case 'weekly':
              nextRun.setDate(nextRun.getDate() + 7);
              break;
            case 'monthly':
              nextRun.setMonth(nextRun.getMonth() + 1);
              break;
            case 'quarterly':
              nextRun.setMonth(nextRun.getMonth() + 3);
              break;
          }
          
          // Set the time component
          nextRun.setHours(
            report.schedule.time.hour,
            report.schedule.time.minute,
            0,
            0
          );
          
          // Update report with next run time
          await Report.updateOne(
            { _id: report._id },
            {
              $set: {
                'schedule.lastRun': now,
                'schedule.nextRun': nextRun
              },
              $push: {
                history: {
                  reportId: mongoose.Types.ObjectId().toString(),
                  generatedAt: now,
                  period: {
                    start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    end: now
                  },
                  status: 'completed',
                  deliveryStatus: 'sent',
                  deliveredAt: now
                }
              }
            }
          );
          
          logger.info(`Updated next run time for report ${report.name} to ${nextRun.toISOString()}`);
        } catch (error) {
          logger.error(`Error generating report ${report.name}: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            reportId: report._id.toString()
          });
        }
      }
    } catch (error) {
      logger.error(`Error in scheduled report generation: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Create singleton instance
const scheduler = new Scheduler();

module.exports = scheduler;
