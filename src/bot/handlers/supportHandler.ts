import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { prisma } from '../../utils/db';
import { userService } from '../../services/userService';
import notificationService from '../../services/notificationService';
import { SessionState, getSession, setSession, clearSession, updateSessionData } from '../../utils/session';
import { getSupportTicketKeyboard, getBackKeyboard } from '../../utils/keyboards';
import logger, { logError } from '../../utils/logger';

type BotContext = Context<Update>;

export async function handleSupportStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  // Check for open tickets
  const openTickets = await prisma.supportTicket.findMany({
    where: {
      userId: user.id,
      status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (openTickets.length > 0) {
    const ticket = openTickets[0];
    await ctx.reply(
      `📞 <b>Open Support Ticket</b>\n\n` +
      `📝 Subject: ${ticket.subject}\n` +
      `📊 Status: ${ticket.status}\n` +
      `📅 Created: ${new Date(ticket.createdAt).toLocaleString()}\n\n` +
      `Reply to continue the conversation:`,
      { parse_mode: 'HTML', ...getSupportTicketKeyboard(ticket.id) }
    );
    return;
  }

  setSession(telegramId, { state: SessionState.ENTERING_SUPPORT_SUBJECT });

  await ctx.reply(
    '📞 <b>Support</b>\n\n' +
    'Please enter the subject of your inquiry:',
    { parse_mode: 'HTML' }
  );
}

export async function handleSupportSubject(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_SUPPORT_SUBJECT) return;

  const subject = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

  if (!subject || subject.length < 3) {
    await ctx.reply('⚠️ Please enter a valid subject (at least 3 characters):');
    return;
  }

  updateSessionData(telegramId, { supportSubject: subject });
  setSession(telegramId, { state: SessionState.ENTERING_SUPPORT_MESSAGE });

  await ctx.reply(
    `📝 Subject: ${subject}\n\n` +
    `Please describe your issue or question:`
  );
}

export async function handleSupportMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_SUPPORT_MESSAGE) return;

  const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

  if (!message || message.length < 10) {
    await ctx.reply('⚠️ Please provide more details (at least 10 characters):');
    return;
  }

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: session.data.supportSubject as string,
        status: 'OPEN',
      },
    });

    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: String(telegramId),
        message,
        isFromAdmin: false,
      },
    });

    clearSession(telegramId);

    await ctx.reply(
      `✅ <b>Support Ticket Created!</b>\n\n` +
      `📝 Ticket ID: ${ticket.id}\n` +
      `📋 Subject: ${session.data.supportSubject}\n\n` +
      `Our team will respond as soon as possible.\n` +
      `You'll receive a notification when there's a reply.`,
      { parse_mode: 'HTML' }
    );

    // Notify admin of new support ticket
    notificationService.notifyAdminNewTicket({
      id: ticket.id,
      subject: ticket.subject,
      user: { firstName: user.firstName, telegramId: String(telegramId) },
    }).catch((err) => logger.warn(`Failed to notify admin of new ticket: ${err instanceof Error ? err.message : String(err)}`));

  } catch (error) {
    logError('Error creating support ticket', error);
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
}

export async function handleTicketReply(ctx: Context, ticketId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setSession(telegramId, {
    state: SessionState.ENTERING_SUPPORT_MESSAGE,
    data: { ticketId, supportSubject: 'reply' },
  });

  await ctx.reply('Type your reply:');
}

export async function handleResolveTicket(ctx: Context, ticketId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        closedAt: new Date(),
      },
    });

    await ctx.reply('✅ Ticket marked as resolved.');
  } catch (error) {
    logError('Error resolving ticket', error);
    await ctx.reply('❌ Error resolving ticket.');
  }
}

export async function handleMyTickets(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (tickets.length === 0) {
    await ctx.reply('📭 No support tickets found.');
    return;
  }

  let message = '🎫 <b>Your Tickets</b>\n\n';

  for (const ticket of tickets) {
    const statusEmoji = {
      OPEN: '🟢',
      IN_PROGRESS: '🟡',
      WAITING_USER: '🔴',
      RESOLVED: '✅',
      CLOSED: '🔒',
    }[ticket.status] || '❓';

    message += `${statusEmoji} ${ticket.subject}\n`;
    message += `   ID: ${ticket.id} • ${new Date(ticket.createdAt).toLocaleDateString()}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
}

export default {
  handleSupportStart,
  handleSupportSubject,
  handleSupportMessage,
  handleTicketReply,
  handleResolveTicket,
  handleMyTickets,
};
