import { prisma } from '../utils/db';
import logger from '../utils/logger';

export interface CreateUserData {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
}

export interface UpdateUserBankData {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

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

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_USER: 'WAITING_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

class UserService {
  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId: string | number): Promise<{
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    phoneNumber: string | null;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    isVerified: boolean;
    isBanned: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
    });
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<{
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    isVerified: boolean;
    isBanned: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    logger.info(`Creating user: ${data.telegramId}`);
    return prisma.user.create({
      data: {
        telegramId: String(data.telegramId),
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }

  /**
   * Update user's bank details
   */
  async updateBankDetails(userId: string, data: UpdateUserBankData): Promise<{
    id: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    isVerified: boolean;
  }> {
    logger.info(`Updating bank details for user: ${userId}`);
    return prisma.user.update({
      where: { id: userId },
      data: {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        isVerified: true,
      },
    });
  }

  /**
   * Update user profile
   */
  async update(userId: string, data: Record<string, unknown>): Promise<{
    id: string;
    [key: string]: unknown;
  }> {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Check if user is registered (has bank details)
   */
  isRegistered(user: { bankName: string | null; accountNumber: string | null; accountName: string | null }): boolean {
    return !!(user.bankName && user.accountNumber && user.accountName);
  }

  /**
   * Ban/unban user
   */
  async setBanned(userId: string, banned: boolean): Promise<{ id: string; isBanned: boolean }> {
    return prisma.user.update({
      where: { id: userId },
      data: { isBanned: banned },
    });
  }

  /**
   * Get all users with pagination
   */
  async getAll(page: number = 1, limit: number = 20): Promise<{
    users: Array<{
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string;
      lastName: string | null;
      bankName: string | null;
      isVerified: boolean;
      isBanned: boolean;
      createdAt: Date;
    }>;
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          bankName: true,
          isVerified: true,
          isBanned: true,
          createdAt: true,
        },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    bannedUsers: number;
    newUsersToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, verifiedUsers, bannedUsers, newUsersToday] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
    ]);

    return { totalUsers, verifiedUsers, bannedUsers, newUsersToday };
  }

  /**
   * Delete user
   */
  async delete(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
    logger.info(`Deleted user: ${userId}`);
  }

  /**
   * Search users by query
   */
  async search(query: string, page: number = 1, limit: number = 20): Promise<{
    users: Array<{
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string;
      lastName: string | null;
      bankName: string | null;
      createdAt: Date;
    }>;
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { telegramId: { contains: query } },
        { username: { contains: query } },
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { accountName: { contains: query } },
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          bankName: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    };
  }
}

export const userService = new UserService();
export default userService;
