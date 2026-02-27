import { prisma } from '../utils/db';
import logger from '../utils/logger';
import cryptoService from './cryptoService';

// Transaction types and statuses as string constants
export const TransactionType = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  EXCHANGE: 'EXCHANGE',
} as const;

export const TransactionStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

type TransactionStatusType = typeof TransactionStatus[keyof typeof TransactionStatus];
type TransactionTypeType = typeof TransactionType[keyof typeof TransactionType];

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
  paymentId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreateTransactionData {
  userId: string;
  walletId?: string;
  type: string;
  cryptocurrency: string;
  network: string;
  amount: number;
  toAddress: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  requiredConfirmations?: number;
  paymentId?: string;  // NOWPayments payment_id
}

export interface TransactionFilter {
  status?: string;
  type?: string;
  userId?: string;
  cryptocurrency?: string;
}

class TransactionService {
  /**
   * Create a new transaction
   */
  async create(data: CreateTransactionData): Promise<Transaction> {
    logger.info(`Creating transaction for user ${data.userId}: ${data.amount} ${data.cryptocurrency}`);

    // Get current exchange rate
    const rate = await cryptoService.getCryptoRate(data.cryptocurrency);
    const priceUsd = rate?.priceUsd || 0;
    
    // Calculate exchange with fees
    const exchange = cryptoService.calculateExchange(data.amount, data.cryptocurrency, priceUsd);

    return prisma.transaction.create({
      data: {
        userId: data.userId,
        walletId: data.walletId,
        type: data.type,
        cryptocurrency: data.cryptocurrency,
        network: data.network,
        amount: data.amount,
        amountUsd: exchange.grossUsd,
        toAddress: data.toAddress,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        exchangeRate: priceUsd,
        feePercent: exchange.feePercent,
        feeAmount: exchange.feeUsd,
        netAmount: exchange.netUsd,
        status: TransactionStatus.PENDING,
        requiredConfirmations: data.requiredConfirmations || 3,
        paymentId: data.paymentId,
      },
    });
  }

  /**
   * Get transaction by ID
   */
  async getById(id: string): Promise<Transaction & { user?: { telegramId: string; firstName: string; lastName: string | null; accountName: string | null; bankName: string | null; accountNumber: string | null } } | null> {
    return prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            lastName: true,
            accountName: true,
            bankName: true,
            accountNumber: true,
          },
        },
        wallet: true,
      },
    });
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    id: string,
    status: string,
    additionalData?: Partial<Transaction>
  ): Promise<Transaction> {
    const updateData: Partial<Transaction> = { status, ...additionalData };

    if (status === TransactionStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return prisma.transaction.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update transaction with blockchain data
   */
  async updateBlockchainData(
    id: string,
    data: {
      txHash: string;
      fromAddress: string;
      confirmations: number;
    }
  ): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id },
      data: {
        txHash: data.txHash,
        fromAddress: data.fromAddress,
        confirmations: data.confirmations,
        status: TransactionStatus.CONFIRMING,
      },
    });
  }

  /**
   * Get pending transactions
   */
  async getPending(): Promise<Array<Transaction & { user: { telegramId: string; firstName: string; lastName: string | null } }>> {
    return prisma.transaction.findMany({
      where: {
        status: {
          in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING, TransactionStatus.CONFIRMED],
        },
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<Array<Transaction & { user: { telegramId: string; firstName: string; lastName: string | null } }>>;
  }

  /**
   * Get transactions by user
   */
  async getByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    transactions: Transaction[];
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get transactions with filters
   */
  async getFiltered(
    filter: TransactionFilter,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    transactions: Array<Transaction & { user: { telegramId: string; firstName: string } }>;
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.userId) where.userId = filter.userId;
    if (filter.cryptocurrency) where.cryptocurrency = filter.cryptocurrency;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { telegramId: true, firstName: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions as Array<Transaction & { user: { telegramId: string; firstName: string } }>,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve transaction (mark as paid)
   */
  async approve(
    transactionId: string,
    adminId: string,
    notes?: string
  ): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.COMPLETED,
        approvedBy: adminId,
        approvedAt: new Date(),
        adminNotes: notes,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Cancel transaction
   */
  async cancel(transactionId: string, reason?: string): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.CANCELLED,
        adminNotes: reason,
      },
    });
  }

  /**
   * Get transaction statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    totalVolumeUsd: number;
    totalFeesUsd: number;
  }> {
    const [total, pending, completed, volume] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.count({
        where: { status: { in: [TransactionStatus.PENDING, TransactionStatus.CONFIRMING] } },
      }),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amountUsd: true, feeAmount: true },
      }),
    ]);

    return {
      total,
      pending,
      completed,
      totalVolumeUsd: volume._sum.amountUsd || 0,
      totalFeesUsd: volume._sum.feeAmount || 0,
    };
  }

  /**
   * Calculate user's total volume
   */
  async getUserVolume(userId: string): Promise<{
    totalTransactions: number;
    totalVolumeUsd: number;
    totalFeesPaid: number;
  }> {
    const result = await prisma.transaction.aggregate({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
      },
      _count: true,
      _sum: { amountUsd: true, feeAmount: true },
    });

    return {
      totalTransactions: result._count,
      totalVolumeUsd: result._sum.amountUsd || 0,
      totalFeesPaid: result._sum.feeAmount || 0,
    };
  }
}

export const transactionService = new TransactionService();
export default transactionService;
