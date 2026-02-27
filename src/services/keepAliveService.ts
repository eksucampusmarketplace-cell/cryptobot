import axios from 'axios';
import logger, { logError } from '../utils/logger';
import { config } from '../config';

class KeepAliveService {
  private isRunning = false;
  private selfUrl: string | null = null;

  start() {
    logger.info('Starting keep-alive service...');

    // Determine self URL from environment or webhook URL
    this.selfUrl = process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL || null;

    if (this.selfUrl) {
      logger.info(`Self ping URL: ${this.selfUrl}`);
    } else {
      logger.warn('No SELF_URL or RENDER_EXTERNAL_URL configured - self-ping disabled');
    }

    if (config.webapp.url) {
      logger.info(`WebApp ping URL: ${config.webapp.url}`);
    } else {
      logger.warn('No WEBAPP_URL configured - webapp ping disabled');
    }

    // Run every minute
    const cron = require('node-cron');
    cron.schedule('* * * * *', () => this.ping());

    // Also run once on startup after 10 seconds
    setTimeout(() => this.ping(), 10000);
  }

  private async ping() {
    if (this.isRunning) {
      logger.debug('Keep-alive ping already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const promises: Promise<void>[] = [];

      // Ping self (bot's health endpoint)
      if (this.selfUrl) {
        promises.push(this.pingSelf());
      }

      // Ping webapp to keep it alive
      if (config.webapp.url) {
        promises.push(this.pingWebapp());
      }

      await Promise.allSettled(promises);
    } catch (error) {
      logError('Error in keep-alive service', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async pingSelf(): Promise<void> {
    if (!this.selfUrl) return;

    const healthUrl = `${this.selfUrl}/health`;
    
    try {
      const response = await axios.get(healthUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      logger.debug(`Self ping successful: ${healthUrl} (status: ${response.status})`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.warn(`Self ping failed for ${healthUrl}: ${error.message}`);
      } else {
        logError('Self ping error', error);
      }
    }
  }

  private async pingWebapp(): Promise<void> {
    if (!config.webapp.url) return;

    const webappUrl = config.webapp.url;
    
    try {
      const response = await axios.get(webappUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      logger.debug(`WebApp ping successful: ${webappUrl} (status: ${response.status})`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.warn(`WebApp ping failed for ${webappUrl}: ${error.message}`);
      } else {
        logError('WebApp ping error', error);
      }
    }
  }
}

export const keepAliveService = new KeepAliveService();
export default keepAliveService;
