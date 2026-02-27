import { prisma } from '../utils/db';
import { Transaction } from '@prisma/client';
import { Telegraf, Context } from 'telegraf';
import { config } from '../config';
import logger from '../utils/logger';

class NotificationService {
  private bot: Telegraf<Context> | null = null;

  setBot(bot: Telegraf<Context>) {
    this.bot = bot;
  }

  /**
   * Send notification to user
   */
  async sendToUser(telegramId: string | number, message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!this.bot) {
      logger.error('Bot not initialized for notifications');
      return false;
    }

    try {
      await this.bot.telegram.sendMessage(String(telegramId), message, { parse_mode: parseMode });
      logger.debug(`Sent notification to user ${telegramId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send notification to user ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Send notification to admin
   */
  async sendToAdmin(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!config.telegram.adminChatId) {
      logger.warn('Admin chat ID not configured');
      return false;
    }

    return this.sendToUser(config.telegram.adminChatId, message, parseMode);
  }

  /**
   * Notify admin of new deposit
   */
  async notifyAdminDeposit(transaction: Transaction & { user: { telegramId: string; firstName: string; lastName: string | null; accountName: string | null; bankName: string | null; accountNumber: string | null } }): Promise<void> {
    const message = `
🔔 <b>NEW CRYPTO DEPOSIT DETECTED</b>

👤 <b>User:</b> ${transaction.user.firstName} ${transaction.user.lastName || ''}
🆔 <b>Telegram ID:</b> <code>${transaction.user.telegramId}</code>

💰 <b>Crypto:</b> ${transaction.amount} ${transaction.cryptocurrency}
💵 <b>USD Value:</b> $${transaction.amountUsd?.toFixed(2) || 'N/A'}
🌐 <b>Network:</b> ${transaction.network}
📝 <b>Tx Hash:</b> <code>${transaction.txHash || 'Pending'}</code>

🏦 <b>Bank Details:</b>
• Bank: ${transaction.user.bankName || 'Not set'}
• Account: ${transaction.user.accountNumber || 'Not set'}
• Name: ${transaction.user.accountName || 'Not set'}

💰 <b>Payout Amount:</b> $${transaction.netAmount?.toFixed(2) || 'N/A'}

⚠️ <b>Action Required:</b> Send bank transfer and mark as paid
`.trim();

    await this.sendToAdmin(message);
  }

  /**
   * Notify user of deposit confirmation
   */
  async notifyUserDepositConfirmed(telegramId: string | number, transaction: Transaction): Promise<void> {
    const message = `
✅ <b>DEPOSIT CONFIRMED!</b>

💰 <b>Amount:</b> ${transaction.amount} ${transaction.cryptocurrency}
💵 <b>USD Value:</b> $${transaction.amountUsd?.toFixed(2) || 'N/A'}

⏳ Processing your payout...
We'll notify you once the bank transfer is sent.
`.trim();

    await this.sendToUser(telegramId, message);
  }

  /**
   * Notify user of payment sent
   */
  async notifyUserPaymentSent(telegramId: string | number, transaction: Transaction): Promise<void> {
    const message = `
🎉 <b>PAYMENT SENT!</b>

💰 <b>Amount:</b> $${transaction.netAmount?.toFixed(2) || 'N/A'}
🏦 <b>Bank:</b> ${transaction.bankName}
📱 <b>Account:</b> ${transaction.accountNumber}
👤 <b>Account Name:</b> ${transaction.accountName}

📝 <b>Transaction ID:</b> <code>${transaction.id}</code>

Thank you for using our service! 🙏
Need help? Use /support
`.trim();

    await this.sendToUser(telegramId, message);
  }

  /**
   * Notify user of transaction cancellation
   */
  async notifyUserTransactionCancelled(
    telegramId: string | number,
    transaction: Transaction,
    reason?: string
  ): Promise<void> {
    const message = `
❌ <b>TRANSACTION CANCELLED</b>

💰 <b>Amount:</b> ${transaction.amount} ${transaction.cryptocurrency}
📝 <b>Transaction ID:</b> <code>${transaction.id}</code>

${reason ? `📋 <b>Reason:</b> ${reason}` : ''}

Please contact support if you have questions.
`.trim();

    await this.sendToUser(telegramId, message);
  }

  /**
   * Broadcast message to all users
   */
  async broadcast(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<{
    success: number;
    failed: number;
  }> {
    if (!this.bot) {
      logger.error('Bot not initialized for broadcast');
      return { success: 0, failed: 0 };
    }

    const users = await prisma.user.findMany({
      select: { telegramId: true },
      where: { isBanned: false },
    });

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await this.bot.telegram.sendMessage(user.telegramId, message, { parse_mode: parseMode });
        success++;
        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch {
        failed++;
      }
    }

    logger.info(`Broadcast completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Create notification record
   */
  async createNotification(
    type: string,
    message: string,
    userId?: string,
    transactionId?: string
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        type,
        message,
        userId,
        transactionId,
      },
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
