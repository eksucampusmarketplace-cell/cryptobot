import { prisma } from '../utils/db';
import logger from '../utils/logger';

export interface Transaction {
  id: string;
  userId: string;
  walletId: string | null;
  type: string;
  cryptocurrency: string;
  network: string;
  amount: number;
  amountUsd: number | null;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  exchangeRate: number | null;
  feePercent: number | null;
  feeAmount: number | null;
  netAmount: number | null;
  status: string;
  confirmations: number;
  requiredConfirmations: number;
  approvedBy: string | null;
  approvedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

import { TransactionStatus } from '../services/transactionService';
import notificationService from '../services/notificationService';
import cryptoService from '../services/cryptoService';
import { CRYPTO_CONFIG } from '../config';

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
      // Get all transactions with pending status
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING],
          },
        },
        include: {
          wallet: true,
          user: true,
        },
      });

      logger.debug(`Checking ${pendingTransactions.length} pending transactions`);

      for (const tx of pendingTransactions) {
        if (!tx.wallet) continue;

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
    const { wallet, user } = tx;

    // Check for new deposits
    const deposits = await cryptoService.checkDeposits(
      tx.cryptocurrency,
      tx.network,
      wallet.address
    );

    // Find deposit matching our expected amount (with some tolerance)
    const matchingDeposit = deposits.find((d) => {
      const expectedAmount = tx.amount;
      const tolerance = 0.01; // 1% tolerance
      return (
        Math.abs(d.amount - expectedAmount) / expectedAmount <= tolerance &&
        d.toAddress.toLowerCase() === wallet.address.toLowerCase()
      );
    });

    if (!matchingDeposit) {
      // No matching deposit yet
      if (tx.status === TransactionStatus.PENDING && deposits.length > 0) {
        // There are deposits but none match - might be partial payment
        logger.warn(
          `Unmatched deposit for transaction ${tx.id}: found ${deposits.length} deposits`
        );
      }
      return;
    }

    // Update transaction with blockchain data
    if (!tx.txHash) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          txHash: matchingDeposit.txHash,
          fromAddress: matchingDeposit.fromAddress,
          confirmations: matchingDeposit.confirmations,
          status: TransactionStatus.CONFIRMING,
        },
      });

      // Notify user
      await notificationService.sendToUser(
        user.telegramId,
        `📥 <b>Deposit Detected!</b>\n\n` +
        `Amount: ${matchingDeposit.amount} ${tx.cryptocurrency}\n` +
        `Tx: <code>${matchingDeposit.txHash}</code>\n\n` +
        `Waiting for confirmations...`,
        'HTML'
      );
    }

    // Check confirmations
    const cryptoConfig = CRYPTO_CONFIG[tx.cryptocurrency];
    const requiredConfirmations = cryptoConfig?.confirmations || 3;

    if (matchingDeposit.confirmations >= requiredConfirmations) {
      // Transaction confirmed!
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.CONFIRMED,
          confirmations: matchingDeposit.confirmations,
        },
      });

      // Notify user
      await notificationService.notifyUserDepositConfirmed(user.telegramId, tx);

      // Notify admin
      await notificationService.notifyAdminDeposit({
        ...tx,
        user: {
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          accountName: user.accountName,
          bankName: user.bankName,
          accountNumber: user.accountNumber,
        },
      });

      logger.info(`Transaction ${tx.id} confirmed with ${matchingDeposit.confirmations} confirmations`);
    } else {
      // Update confirmations count
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { confirmations: matchingDeposit.confirmations },
      });

      logger.debug(
        `Transaction ${tx.id}: ${matchingDeposit.confirmations}/${requiredConfirmations} confirmations`
      );
    }
  }
}

export const depositChecker = new DepositChecker();
export default depositChecker;