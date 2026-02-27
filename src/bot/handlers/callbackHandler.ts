import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { SessionState, getSession } from '../../utils/session';
import * as userHandler from './userHandler';
import * as sellHandler from './sellHandler';
import * as adminHandler from './adminHandler';
import * as supportHandler from './supportHandler';
import logger, { logError } from '../../utils/logger';

type BotContext = Context<Update>;
type CallbackQuery = Update.CallbackQueryUpdate['callback_query'];

function getCallbackData(ctx: Context): string | null {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return null;
  return (ctx.callbackQuery as CallbackQuery & { data: string }).data;
}

export async function handleCallback(ctx: Context): Promise<void> {
  const data = getCallbackData(ctx);
  if (!data) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Answer callback to remove loading state
  await ctx.answerCbQuery();

  // Parse callback data
  const [action, ...params] = data.split('_');

  try {
    switch (action) {
      // Crypto selection
      case 'crypto':
        await sellHandler.handleCryptoSelection(ctx, params[0]);
        break;

      // Network selection
      case 'network':
        await sellHandler.handleNetworkSelection(ctx, params[0]);
        break;

      // Bank selection
      case 'bank':
        await userHandler.handleBankSelection(ctx, data);
        break;

      // Confirmation
      case 'confirm':
        if (params[0] === 'new') {
          await sellHandler.handleConfirmSale(ctx);
        }
        break;

      // Cancel
      case 'cancel':
        await sellHandler.handleCancelSale(ctx);
        break;

      // Settings
      case 'settings':
        switch (params[0]) {
          case 'bank':
            await userHandler.handleUpdateBank(ctx);
            break;
          case 'account':
            await userHandler.handleUpdateAccount(ctx);
            break;
          case 'name':
            await userHandler.handleUpdateName(ctx);
            break;
          case 'delete':
            await userHandler.handleDeleteAccount(ctx);
            break;
        }
        break;

      // Admin transaction actions
      case 'tx':
        if (!adminHandler.isAdmin(telegramId)) {
          await ctx.reply('⚠️ Unauthorized.');
          return;
        }
        switch (params[0]) {
          case 'paid':
            await adminHandler.handleMarkAsPaid(ctx, params[1]);
            break;
          case 'process':
            await adminHandler.handleMarkProcessing(ctx, params[1]);
            break;
          case 'cancel':
            await adminHandler.handleCancelTransaction(ctx, params[1]);
            break;
          case 'contact':
            // TODO: Implement contact user
            await ctx.reply('Contact user feature coming soon.');
            break;
        }
        break;

      // Admin pagination
      case 'users':
        if (params[0] === 'page') {
          await adminHandler.handleUsers(ctx, parseInt(params[1]));
        }
        break;

      // Support ticket actions
      case 'ticket':
        switch (params[0]) {
          case 'reply':
            await supportHandler.handleTicketReply(ctx, params[1]);
            break;
          case 'resolve':
            await supportHandler.handleResolveTicket(ctx, params[1]);
            break;
          case 'close':
            await supportHandler.handleResolveTicket(ctx, params[1]);
            break;
        }
        break;

      // Back button
      case 'back':
        const session = getSession(telegramId);
        // Reset to main menu
        await ctx.reply('Main menu:', { reply_markup: { remove_keyboard: true } });
        break;

      // No operation
      case 'noop':
        break;

      default:
        logger.warn(`Unknown callback action: ${action}`);
    }
  } catch (error) {
    logError(`Error handling callback ${data}`, error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
}

export default handleCallback;
