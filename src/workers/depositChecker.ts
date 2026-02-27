import { prisma } from '../utils/db';
import logger from '../utils/logger';
import { TransactionStatus } from '../services/transactionService';
import notificationService from '../services/notificationService';
import nowpaymentsService from '../services/nowpaymentsService';

class DepositChecker {
  private isRunning = false;

  start() {
    logger.info('Starting deposit checker...');

    // Check deposits every minute
    const cron = require('node-cron');
    cron.schedule('* * * * *', () => this.checkDeposits());

    // Also run once on startup
    setTimeout(() => this.checkDeposits(), 5000);
  }

  async checkDeposits() {
    if (this.isRunning) {
      logger.debug('Deposit check already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      // Get all transactions with pending status that have a paymentId (NOWPayments)
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING],
          },
          paymentId: {
            not: null,
          },
        },
        include: {
          user: true,
        },
      });

      logger.debug(`Checking ${pendingTransactions.length} pending NOWPayments transactions`);

      for (const tx of pendingTransactions) {
        try {
          await this.checkTransaction(tx as any);
        } catch (error) {
          logger.error(`Error checking transaction ${tx.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in deposit checker:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkTransaction(tx: any) {
    const { user } = tx;

    if (!tx.paymentId) {
      logger.debug(`Transaction ${tx.id} has no paymentId, skipping`);
      return;
    }

    // Check payment status via NOWPayments API
    const payment = await nowpaymentsService.getPaymentStatus(Number(tx.paymentId));

    if (!payment) {
      logger.warn(`Could not fetch payment status for ${tx.paymentId}`);
      return;
    }

    // Map NOWPayments status to our status
    const statusMap: Record<string, string> = {
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

    const newStatus = statusMap[payment.payment_status];
    if (!newStatus) {
      logger.warn(`Unknown NOWPayments status: ${payment.payment_status}`);
      return;
    }

    // If status changed, update and notify
    if (newStatus !== tx.status) {
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      // Update amount if actually paid is different
      if (payment.amount_received && payment.amount_received > 0) {
        updateData.amount = payment.amount_received;
      }

      // Calculate confirmations based on status
      if (payment.payment_status === 'confirmed') {
        updateData.confirmations = tx.requiredConfirmations;
      } else if (payment.payment_status === 'confirming') {
        updateData.confirmations = Math.max(1, Math.floor(tx.requiredConfirmations / 2));
      }

      await prisma.transaction.update({
        where: { id: tx.id },
        data: updateData,
      });

      // Handle notifications
      if (newStatus === TransactionStatus.CONFIRMED) {
        // Notify user
        await notificationService.notifyUserDepositConfirmed(user.telegramId, {
          ...tx,
          status: newStatus,
        });

        // Notify admin
        await notificationService.notifyAdminConfirmedDeposit({
          ...tx,
          status: newStatus,
          user: {
            telegramId: user.telegramId,
            firstName: user.firstName,
            lastName: user.lastName,
            accountName: user.accountName,
            bankName: user.bankName,
            accountNumber: user.accountNumber,
          },
        });

        logger.info(`Transaction ${tx.id} confirmed via NOWPayments polling`);
      } else if (newStatus === TransactionStatus.CONFIRMING && tx.status === TransactionStatus.PENDING) {
        // First detection
        await notificationService.sendToUser(
          user.telegramId,
          `📥 <b>Deposit Detected!</b>\n\n` +
          `Amount: ${payment.pay_amount} ${tx.cryptocurrency}\n` +
          `Status: Confirming...\n\n` +
          `Waiting for confirmations...`,
          'HTML'
        );
      }
    }
  }
}

export const depositChecker = new DepositChecker();
export default depositChecker;