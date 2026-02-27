import { IncomingMessage, ServerResponse } from 'http';
import logger, { logError } from '../utils/logger';
import ipnService from './ipnService';
import { config } from '../config';

/**
 * Simple webhook handler for NOWPayments IPN
 * Can be used with Express or Node's built-in http module
 */

export interface WebhookRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

export interface WebhookResponse {
  statusCode: number;
  body: string;
}

class WebhookService {
  /**
   * Handle incoming webhook request
   * Compatible with Express req/res or http.IncomingMessage/ServerResponse
   */
  async handleWebhook(
    req: IncomingMessage | WebhookRequest,
    res: ServerResponse | { statusCode: number; end: (data: string) => void }
  ): Promise<void> {
    // Check if IPN is enabled
    if (!config.ipn.enabled) {
      logger.warn('IPN webhook received but IPN is disabled');
      this.sendResponse(res, 403, 'IPN disabled');
      return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      this.sendResponse(res, 405, 'Method not allowed');
      return;
    }

    try {
      // Parse body if needed
      const body = await this.parseBody(req);
      
      // Get signature from headers
      const headers = 'headers' in req ? req.headers : {};
      const signature = headers['x-nowpayments-sig'] as string;

      logger.info(`Received IPN webhook for payment ${body.payment_id}`);

      // Process IPN
      const success = await ipnService.processIPN(body as any, signature);

      if (success) {
        this.sendResponse(res, 200, 'OK');
      } else {
        // Return 200 even on processing error to prevent NOWPayments from retrying
        // Log the error for investigation
        this.sendResponse(res, 200, 'Processed with warnings');
      }

    } catch (error) {
      logError('Error handling webhook', error);
      // Return 500 to indicate server error - NOWPayments will retry
      this.sendResponse(res, 500, 'Internal server error');
    }
  }

  /**
   * Parse request body
   */
  private parseBody(req: IncomingMessage | WebhookRequest): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      // If body is already parsed (e.g., by express bodyParser)
      if ('body' in req && typeof req.body === 'object' && req.body !== null) {
        resolve(req.body as Record<string, unknown>);
        return;
      }

      // Otherwise parse from IncomingMessage
      const chunks: Buffer[] = [];
      
      (req as IncomingMessage).on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      (req as IncomingMessage).on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });

      (req as IncomingMessage).on('error', reject);
    });
  }

  /**
   * Send response helper
   */
  private sendResponse(
    res: ServerResponse | { statusCode: number; end: (data: string) => void },
    statusCode: number,
    message: string
  ): void {
    if (res instanceof ServerResponse) {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'text/plain');
      res.end(message);
    } else {
      res.statusCode = statusCode;
      res.end(message);
    }
  }

  /**
   * Get webhook URL path
   */
  getWebhookPath(): string {
    return '/webhook/nowpayments';
  }

  /**
   * Get full webhook URL
   */
  getWebhookUrl(): string {
    if (config.ipn.webhookUrl) {
      return config.ipn.webhookUrl;
    }
    return '';
  }

  /**
   * Check if webhook is properly configured
   */
  isConfigured(): boolean {
    return config.ipn.enabled && !!config.ipn.secret;
  }

  /**
   * Get configuration instructions
   */
  getInstructions(): string {
    return `
🌐 Webhook Configuration

1. Set up a public URL for your bot (using webhook mode or a separate server)
2. Configure the webhook URL in your .env:
   WEBHOOK_URL=https://your-domain.com/webhook/nowpayments

3. In NOWPayments dashboard:
   - Go to Settings → IPN
   - Enable IPN
   - Set URL to: https://your-domain.com/webhook/nowpayments
   - Generate and save the IPN Secret

4. Add the IPN secret to your .env:
   NOWPAYMENTS_IPN_SECRET=your_secret_here
   NOWPAYMENTS_IPN_ENABLED=true

5. Restart the bot

The bot will now receive instant notifications when payments are received!
    `.trim();
  }
}

// Export singleton
export const webhookService = new WebhookService();
export default webhookService;
