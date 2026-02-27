import { Telegraf, Context, session } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import * as dotenv from 'dotenv';

dotenv.config();

import { config, USER_COMMANDS, ADMIN_COMMANDS } from './config';
import { prisma } from './utils/db';
import logger from './utils/logger';
import { SessionState, getSession, clearSession } from './utils/session';
import { getMainKeyboard, getAdminKeyboard } from './utils/keyboards';

// Import handlers
import * as userHandler from './bot/handlers/userHandler';
import * as sellHandler from './bot/handlers/sellHandler';
import * as adminHandler from './bot/handlers/adminHandler';
import * as supportHandler from './bot/handlers/supportHandler';
import * as referralHandler from './bot/handlers/referralHandler';
import callbackHandler from './bot/handlers/callbackHandler';

// Import middleware
import {
  rateLimitMiddleware,
  authMiddleware,
  loggingMiddleware,
  errorMiddleware,
} from './bot/middleware';

// Import services
import notificationService from './services/notificationService';
import depositChecker from './workers/depositChecker';

type BotContext = Context<Update>;

class CryptoBot {
  private bot: Telegraf<BotContext>;

  constructor() {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Telegraf(config.telegram.botToken);
    this.setupMiddleware();
    this.setupHandlers();
    this.setupNotificationService();
  }

  private setupMiddleware() {
    // Error handling
    this.bot.use(errorMiddleware);

    // Logging
    this.bot.use(loggingMiddleware);

    // Rate limiting
    this.bot.use(rateLimitMiddleware);

    // Auth check
    this.bot.use(authMiddleware);
  }

  private setupHandlers() {
    // Set bot commands
    this.setCommands();

    // Start command with referral support
    this.bot.command('start', async (ctx) => {
      const text = ctx.message.text;
      const referralMatch = text.match(/start=ref_(\d+)/);
      
      if (referralMatch) {
        await referralHandler.handleReferralStart(ctx, referralMatch[1]);
      }
      
      await userHandler.handleStart(ctx);
    });

    // User commands
    this.bot.command('sell', sellHandler.handleSell);
    this.bot.command('rates', sellHandler.handleRates);
    this.bot.command('balance', sellHandler.handleBalance);
    this.bot.command('history', sellHandler.handleHistory);
    this.bot.command('settings', userHandler.handleSettings);
    this.bot.command('help', userHandler.handleHelp);
    this.bot.command('referral', referralHandler.handleReferral);
    this.bot.command('support', supportHandler.handleSupportStart);

    // Admin commands
    this.bot.command('admin', adminHandler.handleAdmin);
    this.bot.command('pending', adminHandler.handlePendingTransactions);
    this.bot.command('users', (ctx) => adminHandler.handleUsers(ctx));
    this.bot.command('stats', adminHandler.handleStats);
    this.bot.command('broadcast', adminHandler.handleBroadcastStart);

    // Handle text messages based on session state
    this.bot.on('text', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      const text = ctx.message.text;
      const session = getSession(telegramId);

      // Handle keyboard buttons
      if (await this.handleKeyboardButton(ctx, text)) {
        return;
      }

      // Handle session states
      switch (session.state) {
        case SessionState.ENTERING_ACCOUNT_NUMBER:
          await userHandler.handleAccountNumber(ctx);
          break;

        case SessionState.ENTERING_NAME:
          await userHandler.handleAccountName(ctx);
          break;

        case SessionState.ENTERING_AMOUNT:
          await sellHandler.handleAmountEntry(ctx);
          break;

        case SessionState.ENTERING_SUPPORT_SUBJECT:
          await supportHandler.handleSupportSubject(ctx);
          break;

        case SessionState.ENTERING_SUPPORT_MESSAGE:
          if (session.data.ticketId) {
            // Reply to existing ticket
            // TODO: Implement ticket reply
          } else {
            await supportHandler.handleSupportMessage(ctx);
          }
          break;

        case SessionState.UPDATING_BANK:
        case SessionState.UPDATING_ACCOUNT_NUMBER:
        case SessionState.UPDATING_ACCOUNT_NAME:
          await userHandler.handleSettingsUpdate(ctx);
          break;

        case SessionState.ADMIN_BROADCAST:
          await adminHandler.handleBroadcastSend(ctx);
          break;

        default:
          // Unknown command or message
          if (!text.startsWith('/')) {
            await ctx.reply(
              "I didn't understand that. Please use one of the options below:",
              getMainKeyboard()
            );
          }
      }
    });

    // Handle callback queries
    this.bot.on('callback_query', callbackHandler);
  }

  private async handleKeyboardButton(ctx: BotContext, text: string): Promise<boolean> {
    const telegramId = ctx.from?.id;

    switch (text) {
      case '💰 Sell Crypto':
        await sellHandler.handleSell(ctx);
        return true;

      case '📊 Rates':
        await sellHandler.handleRates(ctx);
        return true;

      case '📜 History':
        await sellHandler.handleHistory(ctx);
        return true;

      case '👤 Settings':
        await userHandler.handleSettings(ctx);
        return true;

      case '🎁 Referral':
        await referralHandler.handleReferral(ctx);
        return true;

      case '📞 Support':
        await supportHandler.handleSupportStart(ctx);
        return true;

      case '❓ Help':
        await userHandler.handleHelp(ctx);
        return true;

      // Admin keyboard
      case '📋 Pending Transactions':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await adminHandler.handlePendingTransactions(ctx);
        }
        return true;

      case '👥 Users':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await adminHandler.handleUsers(ctx);
        }
        return true;

      case '📊 Statistics':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await adminHandler.handleStats(ctx);
        }
        return true;

      case '📢 Broadcast':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await adminHandler.handleBroadcastStart(ctx);
        }
        return true;

      case '⚙️ Settings':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await ctx.reply('Admin settings coming soon!', getAdminKeyboard());
        }
        return true;

      case '🔙 Back to User Mode':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await ctx.reply('Switched to user mode.', getMainKeyboard());
        }
        return true;

      default:
        return false;
    }
  }

  private async setCommands() {
    try {
      // Set user commands
      await this.bot.telegram.setMyCommands(USER_COMMANDS);

      logger.info('Bot commands registered');
    } catch (error) {
      logger.error('Error setting commands:', error);
    }
  }

  private setupNotificationService() {
    notificationService.setBot(this.bot);
  }

  async start() {
    try {
      // Connect to database
      await prisma.$connect();
      logger.info('Database connected');

      // Start deposit checker
      depositChecker.start();

      // Launch bot
      await this.bot.launch();
      logger.info('Bot started successfully');

      // Enable graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private stop(signal: string) {
    logger.info(`Received ${signal}, shutting down...`);
    this.bot.stop(signal);
    prisma.$disconnect();
  }
}

// Start the bot
const bot = new CryptoBot();
bot.start();

export default bot;
