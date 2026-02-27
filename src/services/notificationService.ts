import { prisma } from '../utils/db';
import { Transaction } from '@prisma/client';
import { Telegraf, Context, Markup } from 'telegraf';
import { config } from '../config';
import logger, { logError } from '../utils/logger';

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
      logError(`Failed to send notification to user ${telegramId}`, error);
      return false;
    }
  }

  /**
   * Send notification to admin
   */
  async sendToAdmin(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML', extra?: object): Promise<boolean> {
    if (!config.telegram.adminChatId) {
      logger.warn('Admin chat ID not configured');
      return false;
    }

    if (!this.bot) {
      logger.error('Bot not initialized for admin notifications');
      return false;
    }

    try {
      await this.bot.telegram.sendMessage(config.telegram.adminChatId, message, {
        parse_mode: parseMode,
        ...extra,
      });
      return true;
    } catch (error) {
      logError('Failed to send admin notification', error);
      return false;
    }
  }

  /**
   * Notify admin of new deposit detected
   */
  async notifyAdminDeposit(transaction: Transaction & { user: { telegramId: string; firstName: string; lastName: string | null; accountName: string | null; bankName: string | null; accountNumber: string | null } }): Promise<void> {
    const adminUrl = this.getAdminDashboardUrl();
    const message =
      `🔔 <b>NEW CRYPTO DEPOSIT DETECTED</b>\n\n` +
      `👤 <b>User:</b> ${transaction.user.firstName} ${transaction.user.lastName || ''}\n` +
      `🆔 <b>Telegram ID:</b> <code>${transaction.user.telegramId}</code>\n\n` +
      `💰 <b>Crypto:</b> ${transaction.amount} ${transaction.cryptocurrency}\n` +
      `💵 <b>USD Value:</b> $${transaction.amountUsd?.toFixed(2) || 'N/A'}\n` +
      `🌐 <b>Network:</b> ${transaction.network}\n` +
      `📝 <b>Tx Hash:</b> <code>${transaction.txHash || 'Pending'}</code>\n\n` +
      `🏦 <b>Bank Details:</b>\n` +
      `• Bank: ${transaction.user.bankName || 'Not set'}\n` +
      `• Account: ${transaction.user.accountNumber || 'Not set'}\n` +
      `• Name: ${transaction.user.accountName || 'Not set'}\n\n` +
      `💰 <b>Payout Amount:</b> $${transaction.netAmount?.toFixed(2) || 'N/A'}\n\n` +
      `⚠️ <b>Action Required:</b> Send bank transfer and mark as paid`;

    const extra = adminUrl
      ? {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.webApp('🛡️ Open Dashboard', adminUrl)],
          ]).reply_markup,
        }
      : undefined;

    await this.sendToAdmin(message, 'HTML', extra);
  }

  /**
   * Notify admin when a new user registers
   */
  async notifyAdminNewUser(user: {
    telegramId: string;
    firstName: string;
    lastName?: string | null;
    username?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  }): Promise<void> {
    const message =
      `🆕 <b>NEW USER REGISTERED</b>\n\n` +
      `👤 <b>Name:</b> ${user.firstName} ${user.lastName || ''}\n` +
      `💬 <b>Username:</b> @${user.username || 'N/A'}\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      (user.bankName ? `\n🏦 <b>Bank:</b> ${user.bankName}\n📱 <b>Account:</b> ${user.accountNumber}\n👤 <b>Holder:</b> ${user.accountName}` : '');

    await this.sendToAdmin(message);
  }

  /**
   * Notify admin when a support ticket is opened
   */
  async notifyAdminNewTicket(ticket: {
    id: string;
    subject: string;
    user: { firstName: string; telegramId: string };
  }): Promise<void> {
    const message =
      `🎫 <b>NEW SUPPORT TICKET</b>\n\n` +
      `👤 <b>User:</b> ${ticket.user.firstName} (<code>${ticket.user.telegramId}</code>)\n` +
      `📋 <b>Subject:</b> ${ticket.subject}\n` +
      `🆔 <b>Ticket ID:</b> <code>${ticket.id}</code>\n\n` +
      `Reply via /admin → support tickets`;

    await this.sendToAdmin(message);
  }

  /**
   * Notify admin when a transaction is confirmed on-chain (needs payout)
   */
  async notifyAdminConfirmedDeposit(transaction: Transaction & { user: { telegramId: string; firstName: string; lastName: string | null; accountName: string | null; bankName: string | null; accountNumber: string | null } }): Promise<void> {
    const adminUrl = this.getAdminDashboardUrl();
    const message =
      `✅ <b>DEPOSIT CONFIRMED – ACTION NEEDED</b>\n\n` +
      `👤 <b>User:</b> ${transaction.user.firstName} ${transaction.user.lastName || ''}\n` +
      `🆔 <b>ID:</b> <code>${transaction.user.telegramId}</code>\n\n` +
      `💰 <b>Amount:</b> ${transaction.amount} ${transaction.cryptocurrency}\n` +
      `💵 <b>USD:</b> $${transaction.amountUsd?.toFixed(2) || 'N/A'}\n` +
      `💸 <b>Payout:</b> $${transaction.netAmount?.toFixed(2) || 'N/A'}\n\n` +
      `🏦 <b>Send To:</b>\n` +
      `• Bank: ${transaction.user.bankName || 'Not set'}\n` +
      `• Account: ${transaction.user.accountNumber || 'Not set'}\n` +
      `• Name: ${transaction.user.accountName || 'Not set'}\n\n` +
      `📝 <b>Tx:</b> <code>${transaction.txHash || 'N/A'}</code>`;

    const extra = adminUrl
      ? {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.webApp('🛡️ Dashboard', adminUrl),
              Markup.button.callback('✅ Mark Paid', `tx_paid_${transaction.id}`),
            ],
          ]).reply_markup,
        }
      : {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('✅ Mark Paid', `tx_paid_${transaction.id}`)],
          ]).reply_markup,
        };

    await this.sendToAdmin(message, 'HTML', extra);
  }

  /**
   * Notify user of deposit confirmation
   */
  async notifyUserDepositConfirmed(telegramId: string | number, transaction: Transaction): Promise<void> {
    const message =
      `✅ <b>DEPOSIT CONFIRMED!</b>\n\n` +
      `💰 <b>Amount:</b> ${transaction.amount} ${transaction.cryptocurrency}\n` +
      `💵 <b>USD Value:</b> $${transaction.amountUsd?.toFixed(2) || 'N/A'}\n\n` +
      `⏳ Processing your payout...\n` +
      `We'll notify you once the bank transfer is sent.`;

    await this.sendToUser(telegramId, message);
  }

  /**
   * Notify user of payment sent
   */
  async notifyUserPaymentSent(telegramId: string | number, transaction: Transaction): Promise<void> {
    const message =
      `🎉 <b>PAYMENT SENT!</b>\n\n` +
      `💰 <b>Amount:</b> $${transaction.netAmount?.toFixed(2) || 'N/A'}\n` +
      `🏦 <b>Bank:</b> ${transaction.bankName}\n` +
      `📱 <b>Account:</b> ${transaction.accountNumber}\n` +
      `👤 <b>Account Name:</b> ${transaction.accountName}\n\n` +
      `📝 <b>Transaction ID:</b> <code>${transaction.id}</code>\n\n` +
      `Thank you for using our service! 🙏\n` +
      `Need help? Use /support`;

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
    const message =
      `❌ <b>TRANSACTION CANCELLED</b>\n\n` +
      `💰 <b>Amount:</b> ${transaction.amount} ${transaction.cryptocurrency}\n` +
      `📝 <b>Transaction ID:</b> <code>${transaction.id}</code>\n\n` +
      (reason ? `📋 <b>Reason:</b> ${reason}\n\n` : '') +
      `Please contact support if you have questions.`;

    await this.sendToUser(telegramId, message);
  }

  /**
   * Notify admin of a transaction status change
   */
  async notifyAdminTransactionUpdate(
    action: 'approved' | 'cancelled',
    adminId: string,
    transaction: Transaction & { user?: { firstName?: string; telegramId?: string } }
  ): Promise<void> {
    const emoji = action === 'approved' ? '✅' : '❌';
    const label = action === 'approved' ? 'PAYMENT MARKED AS PAID' : 'TRANSACTION CANCELLED';
    const userName = (transaction as any).user?.firstName || 'Unknown';
    const userId = (transaction as any).user?.telegramId || '—';

    const message =
      `${emoji} <b>${label}</b>\n\n` +
      `👤 User: ${userName} (<code>${userId}</code>)\n` +
      `💰 Amount: ${transaction.amount} ${transaction.cryptocurrency}\n` +
      `💵 USD: $${transaction.amountUsd?.toFixed(2) || 'N/A'}\n` +
      `🆔 Tx ID: <code>${transaction.id}</code>\n` +
      `🛡️ By Admin: <code>${adminId}</code>`;

    await this.sendToAdmin(message);
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
      data: { type, message, userId, transactionId },
    });
  }

  private getAdminDashboardUrl(): string | null {
    const base =
      process.env.WEBAPP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.SELF_URL;
    if (!base) return null;
    const normalized = base.replace(/\/$/, '');
    return normalized.startsWith('http') ? `${normalized}/admin` : `https://${normalized}/admin`;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
