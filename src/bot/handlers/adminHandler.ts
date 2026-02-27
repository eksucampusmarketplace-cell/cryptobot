import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { userService } from '../../services/userService';
import { transactionService, TransactionStatus } from '../../services/transactionService';
import notificationService from '../../services/notificationService';
import { config } from '../../config';
import { getAdminKeyboard, getTransactionActionKeyboard, getPaginationKeyboard } from '../../utils/keyboards';
import { SessionState, setSession, clearSession } from '../../utils/session';
import logger from '../../utils/logger';

type BotContext = Context<Update>;

export function isAdmin(telegramId: number): boolean {
  return String(telegramId) === config.telegram.adminChatId;
}

export async function handleAdmin(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) {
    await ctx.reply('⚠️ Unauthorized access.');
    return;
  }

  await ctx.reply(
    '🔐 <b>Admin Panel</b>\n\n' +
    'Select an action:',
    { parse_mode: 'HTML', ...getAdminKeyboard() }
  );
}

export async function handlePendingTransactions(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  const transactions = await transactionService.getPending();

  if (transactions.length === 0) {
    await ctx.reply('✅ No pending transactions.');
    return;
  }

  for (const tx of transactions.slice(0, 5)) {
    const statusEmoji = {
      PENDING: '⏳',
      CONFIRMING: '🔄',
      CONFIRMED: '✅',
      PROCESSING: '🔄',
    }[tx.status] || '❓';

    await ctx.reply(
      `${statusEmoji} <b>Transaction</b>\n\n` +
      `📝 ID: <code>${tx.id}</code>\n` +
      `👤 User: ${(tx as any).user?.firstName} (${(tx as any).user?.telegramId})\n` +
      `💰 Amount: ${tx.amount} ${tx.cryptocurrency}\n` +
      `💵 USD: $${tx.amountUsd?.toFixed(2) || 'N/A'}\n` +
      `🏦 Bank: ${tx.bankName}\n` +
      `📱 Account: ${tx.accountNumber}\n` +
      `👤 Name: ${tx.accountName}\n` +
      `💰 Payout: $${tx.netAmount?.toFixed(2) || 'N/A'}\n` +
      `📝 Tx: ${tx.txHash || 'Waiting for deposit'}\n` +
      `✅ Confirmations: ${tx.confirmations}/${tx.requiredConfirmations}`,
      { parse_mode: 'HTML', ...getTransactionActionKeyboard(tx.id) }
    );
  }

  if (transactions.length > 5) {
    await ctx.reply(`... and ${transactions.length - 5} more pending transactions.`);
  }
}

export async function handleMarkAsPaid(ctx: Context, transactionId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const transaction = await transactionService.approve(transactionId, String(telegramId), 'Payment sent to user bank account');
    
    // Get user info
    const txWithUser = await transactionService.getById(transactionId);
    if (txWithUser) {
      await notificationService.notifyUserPaymentSent(
        (txWithUser as any).user.telegramId,
        transaction
      );
    }

    await ctx.reply(
      `✅ Transaction marked as paid!\n\n` +
      `User has been notified.`,
      getAdminKeyboard()
    );

    logger.info(`Transaction ${transactionId} marked as paid by admin ${telegramId}`);
  } catch (error) {
    logger.error('Error marking transaction as paid:', error);
    await ctx.reply('❌ Error updating transaction. Please try again.');
  }
}

export async function handleMarkProcessing(ctx: Context, transactionId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    await transactionService.updateStatus(transactionId, TransactionStatus.PROCESSING);
    
    await ctx.reply(
      '🔄 Transaction marked as processing.',
      getAdminKeyboard()
    );
  } catch (error) {
    logger.error('Error updating transaction:', error);
    await ctx.reply('❌ Error updating transaction.');
  }
}

export async function handleCancelTransaction(ctx: Context, transactionId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const transaction = await transactionService.cancel(transactionId, 'Cancelled by admin');
    
    const txWithUser = await transactionService.getById(transactionId);
    if (txWithUser) {
      await notificationService.notifyUserTransactionCancelled(
        (txWithUser as any).user.telegramId,
        transaction,
        'Cancelled by admin'
      );
    }

    await ctx.reply(
      '❌ Transaction cancelled. User has been notified.',
      getAdminKeyboard()
    );
  } catch (error) {
    logger.error('Error cancelling transaction:', error);
    await ctx.reply('❌ Error cancelling transaction.');
  }
}

export async function handleUsers(ctx: Context, page: number = 1): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  const { users, total, pages } = await userService.getAll(page, 10);

  let message = `👥 <b>Users</b> (Total: ${total})\n\n`;

  for (const user of users) {
    const status = user.isBanned ? '🚫' : user.isVerified ? '✅' : '⏳';
    message += `${status} ${user.firstName} (@${user.username || 'N/A'})\n`;
    message += `   ID: ${user.telegramId}\n`;
    message += `   Bank: ${user.bankName || 'Not set'}\n\n`;
  }

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...getPaginationKeyboard('users', page, pages),
  });
}

export async function handleStats(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  const [userStats, txStats] = await Promise.all([
    userService.getStats(),
    transactionService.getStats(),
  ]);

  await ctx.reply(
    `📊 <b>Bot Statistics</b>\n\n` +
    
    `👥 <b>Users:</b>\n` +
    `• Total: ${userStats.totalUsers}\n` +
    `• Verified: ${userStats.verifiedUsers}\n` +
    `• Banned: ${userStats.bannedUsers}\n` +
    `• New Today: ${userStats.newUsersToday}\n\n` +

    `💰 <b>Transactions:</b>\n` +
    `• Total: ${txStats.total}\n` +
    `• Pending: ${txStats.pending}\n` +
    `• Completed: ${txStats.completed}\n\n` +

    `💵 <b>Volume:</b>\n` +
    `• Total: $${txStats.totalVolumeUsd.toFixed(2)}\n` +
    `• Fees Collected: $${txStats.totalFeesUsd.toFixed(2)}`,
    { parse_mode: 'HTML' }
  );
}

export async function handleBroadcastStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  setSession(telegramId, { state: SessionState.ADMIN_BROADCAST });

  await ctx.reply(
    '📢 <b>Broadcast Message</b>\n\n' +
    'Enter the message to send to all users (use HTML formatting):\n\n' +
    'Use /cancel to abort.',
    { parse_mode: 'HTML' }
  );
}

export async function handleBroadcastSend(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

  if (text === '/cancel') {
    clearSession(telegramId);
    await ctx.reply('❌ Broadcast cancelled.', getAdminKeyboard());
    return;
  }

  await ctx.reply('📤 Sending broadcast...');

  const result = await notificationService.broadcast(text);

  clearSession(telegramId);

  await ctx.reply(
    `✅ Broadcast complete!\n\n` +
    `✅ Sent: ${result.success}\n` +
    `❌ Failed: ${result.failed}`,
    getAdminKeyboard()
  );
}

export async function handleBanUser(ctx: Context, targetId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const user = await userService.findByTelegramId(targetId);
    if (!user) {
      await ctx.reply('❌ User not found.');
      return;
    }

    await userService.setBanned(user.id, true);
    await ctx.reply(`✅ User ${user.firstName} (${targetId}) has been banned.`);
  } catch (error) {
    logger.error('Error banning user:', error);
    await ctx.reply('❌ Error banning user.');
  }
}

export async function handleUnbanUser(ctx: Context, targetId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const user = await userService.findByTelegramId(targetId);
    if (!user) {
      await ctx.reply('❌ User not found.');
      return;
    }

    await userService.setBanned(user.id, false);
    await ctx.reply(`✅ User ${user.firstName} (${targetId}) has been unbanned.`);
  } catch (error) {
    logger.error('Error unbanning user:', error);
    await ctx.reply('❌ Error unbanning user.');
  }
}

export default {
  handleAdmin,
  handlePendingTransactions,
  handleMarkAsPaid,
  handleMarkProcessing,
  handleCancelTransaction,
  handleUsers,
  handleStats,
  handleBroadcastStart,
  handleBroadcastSend,
  handleBanUser,
  handleUnbanUser,
  isAdmin,
};
