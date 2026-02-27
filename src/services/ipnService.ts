import crypto from 'crypto';
import logger from '../utils/logger';
import { transactionService, TransactionStatus } from './transactionService';
import notificationService from './notificationService';
import { config } from '../config';

export interface IPNPayload {
  payment_id: number;
  parent_payment_id?: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid?: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: number;
  created_at: string;
  updated_at: string;
  outcome_amount?: number;
  outcome_currency?: string;
  network?: string;
  network_precision?: string;
  type?: string;
  payin_extra_id?: string;
  address?: string;
  provider?: string;
  is_final?: boolean;
  signature?: string;
}

export type IPNPaymentStatus = 
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired';

/**
 * Maps NOWPayments IPN status to our transaction status
 */
const STATUS_MAP: Record<string, string> = {
  'waiting': TransactionStatus.PENDING,
  'confirming': TransactionStatus.CONFIRMING,
  'confirmed': TransactionStatus.CONFIRMED,
  'sending': TransactionStatus.PROCESSING,
  'partially_paid': TransactionStatus.CONFIRMING,
  'finished': TransactionStatus.COMPLETED,
  'failed': TransactionStatus.FAILED,
  'refunded': TransactionStatus.REFUNDED,
  'expired': TransactionStatus.CANCELLED,
};

class IPNService {
  private ipnSecret: string;

  constructor(ipnSecret: string = '') {
    this.ipnSecret = ipnSecret;
  }

  /**
   * Set IPN secret for signature verification
   */
  setIPNSecret(secret: string): void {
    this.ipnSecret = secret;
  }

  /**
   * Verify IPN signature from NOWPayments
   */
  verifySignature(payload: IPNPayload, signature: string): boolean {
    if (!this.ipnSecret) {
      logger.warn('IPN secret not configured, skipping signature verification');
      return true;
    }

    try {
      // Create the message string according to NOWPayments documentation
      const message = this.createMessageString(payload);
      
      // Calculate HMAC-SHA256
      const hmac = crypto.createHmac('sha256', this.ipnSecret);
      hmac.update(message);
      const digest = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(digest, 'utf8')
      );
    } catch (error) {
      logger.error('Error verifying IPN signature:', error);
      return false;
    }
  }

  /**
   * Create message string for signature verification
   * NOWPayments concatenates specific fields in order
   */
  private createMessageString(payload: IPNPayload): string {
    const fields = [
      payload.payment_id,
      payload.payment_status,
      payload.pay_address,
      payload.price_amount,
      payload.price_currency,
      payload.pay_amount,
      payload.pay_currency,
      payload.order_id,
      payload.order_description,
      payload.purchase_id,
      payload.created_at,
      payload.updated_at,
      payload.outcome_amount || '',
      payload.outcome_currency || '',
    ];

    return fields.join(':');
  }

  /**
   * Process incoming IPN notification
   */
  async processIPN(payload: IPNPayload, signature?: string): Promise<boolean> {
    try {
      // Verify signature if provided and configured
      if (signature && !this.verifySignature(payload, signature)) {
        logger.warn('Invalid IPN signature received');
        return false;
      }

      logger.info(`Processing IPN for payment ${payload.payment_id}, status: ${payload.payment_status}`);

      // Find transaction by order_id (which contains our transaction ID)
      const transactionId = payload.order_id;
      if (!transactionId) {
        logger.error('IPN received without order_id');
        return false;
      }

      const transaction = await transactionService.getById(transactionId);
      if (!transaction) {
        logger.error(`Transaction not found: ${transactionId}`);
        return false;
      }

      // Map NOWPayments status to our status
      const newStatus = STATUS_MAP[payload.payment_status];
      if (!newStatus) {
        logger.warn(`Unknown IPN status: ${payload.payment_status}`);
        return false;
      }

      // Update transaction with IPN data
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      // Add blockchain data if available
      if (payload.actually_paid && payload.actually_paid > 0) {
        updateData.amount = payload.actually_paid;
      }

      // Calculate confirmations based on status
      if (payload.payment_status === 'confirmed') {
        updateData.confirmations = transaction.requiredConfirmations;
      } else if (payload.payment_status === 'confirming') {
        updateData.confirmations = Math.max(1, Math.floor(transaction.requiredConfirmations / 2));
      }

      // Update transaction
      await transactionService.updateStatus(transactionId, newStatus, updateData);

      // Send notifications based on status
      await this.handleStatusNotification(transaction, newStatus, payload);

      logger.info(`Transaction ${transactionId} updated to ${newStatus} via IPN`);
      return true;

    } catch (error) {
      logger.error('Error processing IPN:', error);
      return false;
    }
  }

  /**
   * Handle notifications for different statuses
   */
  private async handleStatusNotification(
    transaction: { id: string; user?: { telegramId: string } },
    status: string,
    payload: IPNPayload
  ): Promise<void> {
    if (!transaction.user?.telegramId) return;

    const userId = transaction.user.telegramId;

    switch (status) {
      case TransactionStatus.CONFIRMING:
        await notificationService.sendToUser(
          userId,
          `⏳ Your deposit of ${payload.pay_amount} ${payload.pay_currency} is being confirmed...`
        );
        break;

      case TransactionStatus.CONFIRMED:
        await notificationService.sendToUser(
          userId,
          `✅ Your deposit has been confirmed!\n\n` +
          `Amount: ${payload.pay_amount} ${payload.pay_currency}\n` +
          `Status: Awaiting admin approval for payout`
        );
        // Notify admin with actionable dashboard button
        await notificationService.sendToAdmin(
          `✅ <b>DEPOSIT CONFIRMED (IPN)</b>\n\n` +
          `📝 Transaction: <code>${transaction.id}</code>\n` +
          `💰 Amount: ${payload.pay_amount} ${payload.pay_currency}\n` +
          `💵 USD: ${payload.price_amount}\n\n` +
          `⚠️ Action required: send payout and mark as paid.\n` +
          `Use /pending or open the admin dashboard.`
        );
        break;

      case TransactionStatus.FAILED:
      case TransactionStatus.CANCELLED:
        await notificationService.sendToUser(
          userId,
          `❌ Payment failed or expired.\n\n` +
          `If you sent funds, please contact support with your transaction ID: ${transaction.id}`
        );
        break;

      case TransactionStatus.REFUNDED:
        await notificationService.sendToUser(
          userId,
          `↩️ Your payment has been refunded.\n\n` +
          `Transaction ID: ${transaction.id}`
        );
        break;
    }
  }

  /**
   * Get IPN configuration instructions
   */
  getIPNInstructions(): string {
    return `
📋 IPN Configuration Instructions:

1. Log in to your NOWPayments account
2. Go to Settings → IPN
3. Enable IPN notifications
4. Set IPN URL to: https://your-domain.com/webhook/nowpayments
5. Generate and copy the IPN Secret
6. Add the secret to your .env file:
   NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here

The bot will automatically verify IPN signatures for security.
    `.trim();
  }

  /**
   * Validate IPN configuration
   */
  isConfigured(): boolean {
    return !!this.ipnSecret;
  }
}

// Export singleton instance
export const ipnService = new IPNService(process.env.NOWPAYMENTS_IPN_SECRET);
export default ipnService;
