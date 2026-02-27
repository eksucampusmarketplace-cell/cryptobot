import { prisma } from '../utils/db';
import { TransactionStatus } from './transactionService';

interface DailyVolume {
  day: string;
  volume: number;
}

interface CryptoBreakdown {
  cryptocurrency: string;
  count: number;
}

interface ActivityEvent {
  type: string;
  title: string;
  description: string;
  timestamp: Date;
}

class AdminApiService {
  /**
   * Full analytics snapshot used by the admin mini app
   */
  async getStats(): Promise<{
    users: { total: number; verified: number; banned: number; newToday: number };
    transactions: {
      total: number;
      pending: number;
      completed: number;
      totalVolumeUsd: number;
      totalFeesUsd: number;
    };
    dailyVolume: DailyVolume[];
    cryptoBreakdown: CryptoBreakdown[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      verifiedUsers,
      bannedUsers,
      newUsersToday,
      totalTx,
      pendingTx,
      completedTx,
      volumeAgg,
      cryptoGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.transaction.count(),
      prisma.transaction.count({
        where: {
          status: {
            in: [
              TransactionStatus.PENDING,
              TransactionStatus.CONFIRMING,
              TransactionStatus.CONFIRMED,
              TransactionStatus.PROCESSING,
            ],
          },
        },
      }),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amountUsd: true, feeAmount: true },
      }),
      prisma.transaction.groupBy({
        by: ['cryptocurrency'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Build last-7-days daily volume
    const dailyVolume = await this.getDailyVolume(7);

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        banned: bannedUsers,
        newToday: newUsersToday,
      },
      transactions: {
        total: totalTx,
        pending: pendingTx,
        completed: completedTx,
        totalVolumeUsd: volumeAgg._sum.amountUsd ?? 0,
        totalFeesUsd: volumeAgg._sum.feeAmount ?? 0,
      },
      dailyVolume,
      cryptoBreakdown: cryptoGroups.map((g) => ({
        cryptocurrency: g.cryptocurrency,
        count: g._count.id,
      })),
    };
  }

  /**
   * Build an aggregated activity feed from recent DB records
   */
  async getActivity(limit = 50): Promise<ActivityEvent[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentTx, recentUsers, recentTickets] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { firstName: true, telegramId: true } } },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { firstName: true, telegramId: true, createdAt: true },
      }),
      prisma.supportTicket.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { firstName: true, telegramId: true } } },
      }),
    ]);

    const events: ActivityEvent[] = [];

    for (const tx of recentTx) {
      const name = (tx as any).user?.firstName || 'Unknown';
      const usd = tx.amountUsd?.toFixed(2) || '0.00';
      let type = 'deposit';
      let title = `New ${tx.cryptocurrency} deposit`;
      let description = `${name} · $${usd} · ${tx.status}`;

      if (tx.status === TransactionStatus.COMPLETED) {
        type = 'tx_approved';
        title = `Payment approved`;
        description = `${name} received $${tx.netAmount?.toFixed(2) || usd}`;
      } else if (tx.status === TransactionStatus.CANCELLED || tx.status === TransactionStatus.FAILED) {
        type = 'tx_cancelled';
        title = `Transaction ${tx.status.toLowerCase()}`;
        description = `${name} · ${tx.amount} ${tx.cryptocurrency}`;
      } else if (tx.status === TransactionStatus.CONFIRMING) {
        type = 'tx_confirming';
        title = `Confirming ${tx.cryptocurrency} deposit`;
        description = `${name} · ${tx.amount} ${tx.cryptocurrency}`;
      }

      events.push({ type, title, description, timestamp: tx.createdAt });
    }

    for (const u of recentUsers) {
      events.push({
        type: 'user_registered',
        title: 'New user registered',
        description: `${u.firstName} (${u.telegramId})`,
        timestamp: u.createdAt,
      });
    }

    for (const ticket of recentTickets) {
      const name = (ticket as any).user?.firstName || 'Unknown';
      events.push({
        type: 'ticket_opened',
        title: 'Support ticket opened',
        description: `${name} · ${ticket.subject}`,
        timestamp: ticket.createdAt,
      });
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return events.slice(0, limit);
  }

  /**
   * Get paginated transactions with optional status filter
   */
  async getTransactions(
    page: number,
    limit: number,
    status?: string
  ): Promise<{
    transactions: unknown[];
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, telegramId: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total, pages: Math.ceil(total / limit) };
  }

  /**
   * Get paginated users with optional filter/search
   */
  async getUsers(
    page: number,
    limit: number,
    filter?: string,
    search?: string
  ): Promise<{
    users: unknown[];
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filter === 'VERIFIED') where.isVerified = true;
    if (filter === 'BANNED') where.isBanned = true;

    if (search) {
      where.OR = [
        { telegramId: { contains: search } },
        { username: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { accountName: { contains: search } },
      ];
    }

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
          isVerified: true,
          isBanned: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, pages: Math.ceil(total / limit) };
  }

  /**
   * Get recent audit logs
   */
  async getAuditLogs(limit = 50): Promise<unknown[]> {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(
    adminId: string,
    action: string,
    targetType: string,
    targetId?: string,
    details?: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, details },
    });
  }

  /**
   * Get paginated support tickets with optional status filter
   */
  async getTickets(
    page: number,
    limit: number,
    status?: string
  ): Promise<{
    tickets: unknown[];
    total: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, telegramId: true, username: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { tickets, total, pages: Math.ceil(total / limit) };
  }

  /**
   * Get a single ticket with all messages
   */
  async getTicket(ticketId: string): Promise<{
    ticket: unknown;
    messages: unknown[];
  } | null> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { firstName: true, lastName: true, telegramId: true, username: true } },
      },
    });

    if (!ticket) return null;

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return { ticket, messages };
  }

  /**
   * Reply to a support ticket
   */
  async replyToTicket(
    ticketId: string,
    adminId: string,
    message: string
  ): Promise<{ success: boolean; ticket?: unknown; error?: string }> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { telegramId: true } } },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        message,
        isFromAdmin: true,
      },
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'WAITING_USER', updatedAt: new Date() },
    });

    await this.createAuditLog(adminId, 'TICKET_REPLY', 'ticket', ticketId, message.substring(0, 100));

    return { success: true, ticket };
  }

  /**
   * Resolve a support ticket
   */
  async resolveTicket(ticketId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', closedAt: new Date() },
    });

    await this.createAuditLog(adminId, 'TICKET_RESOLVED', 'ticket', ticketId);

    return { success: true };
  }

  /**
   * Close a support ticket
   */
  async closeTicket(ticketId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await this.createAuditLog(adminId, 'TICKET_CLOSED', 'ticket', ticketId);

    return { success: true };
  }

  /**
   * Get ticket counts by status
   */
  async getTicketCounts(): Promise<{ open: number; inProgress: number; waitingUser: number; resolved: number; closed: number }> {
    const [open, inProgress, waitingUser, resolved, closed] = await Promise.all([
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'WAITING_USER' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
    ]);

    return { open, inProgress, waitingUser, resolved, closed };
  }

  private async getDailyVolume(days: number): Promise<DailyVolume[]> {
    const result: DailyVolume[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const agg = await prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amountUsd: true },
      });

      result.push({
        day: start.toLocaleDateString('en-GB', { weekday: 'short' }),
        volume: agg._sum.amountUsd ?? 0,
      });
    }
    return result;
  }
}

export const adminApiService = new AdminApiService();
export default adminApiService;
