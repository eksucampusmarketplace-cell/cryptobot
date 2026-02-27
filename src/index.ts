import { Telegraf, Context, session, Markup } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import * as dotenv from 'dotenv';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

dotenv.config();

import { config, USER_COMMANDS, ADMIN_COMMANDS } from './config';
import { connectWithRetry, prisma } from './utils/db';
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
import adminApiService from './services/adminApiService';
import depositChecker from './workers/depositChecker';
import webhookService from './services/webhookService';
import ipnService from './services/ipnService';
import paystackService from './services/paystackService';
import keepAliveService from './services/keepAliveService';

type BotContext = Context<Update>;

class CryptoBot {
  private bot: Telegraf<BotContext>;
  private webhookServer?: ReturnType<typeof createServer>;

  constructor() {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Telegraf(config.telegram.botToken);
    this.setupMiddleware();
    this.setupHandlers();
    this.setupNotificationService();
    this.setupIPN();
  }

  private setupIPN() {
    // Configure IPN service with secret
    if (config.ipn.secret) {
      ipnService.setIPNSecret(config.ipn.secret);
      logger.info('IPN service configured');
    }
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
    this.bot.command('dashboard', adminHandler.handleDashboard);
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

      case '🛡️ Admin Dashboard':
        if (telegramId && adminHandler.isAdmin(telegramId)) {
          await adminHandler.handleDashboard(ctx);
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
      // Start webhook server FIRST so Render can detect the port
      this.startWebhookServer();

      // Connect to database in the background (don't block server startup)
      this.connectDatabaseAsync();

      // Enable graceful stop before launching
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));

      // Launch bot with retry logic to handle 409 conflicts on restart
      await this.launchWithRetry();

      // Log IPN status
      if (config.ipn.enabled && config.ipn.secret) {
        logger.info('IPN webhooks enabled - listening for NOWPayments notifications');
      } else if (config.ipn.enabled && !config.ipn.secret) {
        logger.warn('IPN enabled but no secret configured - signatures will not be verified');
      } else {
        logger.info('IPN disabled - using polling only for deposit detection');
      }
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async launchWithRetry(maxAttempts = 5): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.bot.launch({ dropPendingUpdates: true });
        logger.info('Bot started successfully');
        return;
      } catch (error: any) {
        const is409 = error?.response?.error_code === 409 ||
          (error instanceof Error && error.message.includes('409'));

        if (is409 && attempt < maxAttempts) {
          const waitMs = attempt * 5000;
          logger.warn(
            `Bot launch conflict (409) - another instance may still be stopping. ` +
            `Retrying in ${waitMs / 1000}s (attempt ${attempt}/${maxAttempts})...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        } else {
          throw error;
        }
      }
    }
  }

  private async connectDatabaseAsync() {
    try {
      // Connect to database with retry
      await connectWithRetry();
      logger.info('Database connected');

      // Start deposit checker only after DB is connected
      depositChecker.start();

      // Start keep-alive service to prevent sleeping
      keepAliveService.start();
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      // Don't exit - the bot can still work in limited mode
      // and the database might come back online
    }
  }

  /**
   * Start HTTP server for receiving webhooks
   */
  private startWebhookServer() {
    const port = parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3001');
    
    // Log immediately that we're starting the server
    logger.info(`Starting webhook server on port ${port}...`);
    
    this.webhookServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const { pathname, query } = parse(req.url || '', true);

      // Handle NOWPayments IPN webhooks
      if (pathname === webhookService.getWebhookPath()) {
        await webhookService.handleWebhook(req, res);
        return;
      }

      // API: Get list of Nigerian banks
      if (pathname === '/api/banks' && req.method === 'GET') {
        try {
          const banks = await paystackService.getNigerianBanks();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ banks }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch banks';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // API: Resolve account number
      if (pathname === '/api/resolve-account' && req.method === 'GET') {
        const bankCode = query.bank_code as string;
        const accountNumber = query.account_number as string;

        if (!bankCode || !accountNumber) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'bank_code and account_number are required' }));
          return;
        }

        try {
          const result = await paystackService.resolveAccount(accountNumber, bankCode);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            account_name: result.account_name,
            account_number: result.account_number,
            bank_name: result.bank_name 
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to resolve account';
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // API: Register user bank details
      if (pathname === '/api/register' && req.method === 'POST') {
        // Get Telegram WebApp initData
        const initData = query.initData as string || req.headers['x-init-data'] as string;
        
        if (!initData) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // Parse initData to get telegramId
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        
        if (!userJson) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid initData' }));
          return;
        }

        let user: { id: number };
        try {
          user = JSON.parse(decodeURIComponent(userJson));
        } catch {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid user data' }));
          return;
        }

        const telegramId = String(user.id);

        // Read request body
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        let data: {
          bank_name: string;
          bank_code: string;
          account_number: string;
          account_name: string;
        };
        
        try {
          data = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        if (!data.bank_name || !data.account_number || !data.account_name) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        try {
          // Find or create user
          let dbUser = await prisma.user.findUnique({
            where: { telegramId },
          });

          if (!dbUser) {
            logger.info(`Creating new user with telegramId: ${telegramId}`);
            dbUser = await prisma.user.create({
              data: {
                telegramId,
                firstName: 'User',
              },
            });
            logger.info(`User created with id: ${dbUser.id}`);
          }

          // Update bank details
          logger.info(`Updating bank details for user ${dbUser.id}`);
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              bankName: data.bank_name,
              accountNumber: data.account_number,
              accountName: data.account_name,
              isVerified: true,
            },
          });
          logger.info(`Bank details updated successfully for user ${dbUser.id}`);

          // Send welcome message to user via bot
          const welcomeMessage = `✅ <b>Registration Complete!</b>\n\n` +
            `🏦 Bank: ${data.bank_name}\n` +
            `📱 Account: ${data.account_number}\n` +
            `👤 Name: ${data.account_name}\n\n` +
            `You can now sell crypto and receive payments to your bank account!`;

          // Send message through Telegram API
          try {
            const mainKeyboard = Markup.keyboard([
              ['💰 Sell Crypto', '📊 Rates'],
              ['📜 History', '👤 Settings'],
              ['🎁 Referral', '📞 Support'],
              ['❓ Help'],
            ]).resize().oneTime();

            await this.bot.telegram.sendMessage(user.id, welcomeMessage, { 
              parse_mode: 'HTML',
              reply_markup: mainKeyboard.reply_markup as any
            });
          } catch (botError) {
            logger.warn(`Could not send welcome message to user ${user.id}:`, botError);
          }

          // Notify admin of new registration via WebApp
          notificationService.notifyAdminNewUser({
            telegramId,
            firstName: dbUser.firstName,
            bankName: data.bank_name,
            accountNumber: data.account_number,
            accountName: data.account_name,
          }).catch((err) => logger.warn('Failed to send new-user admin notification:', err));

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          logger.error('Failed to save bank details:', error);
          const message = error instanceof Error ? error.message : 'Failed to save bank details';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }

      // Serve WebApp registration page
      if (pathname === '/register' || pathname === '/') {
        const htmlPath = join(__dirname, 'webapp', 'registration.html');
        const htmlPathFallback = join(__dirname, '..', 'src', 'webapp', 'registration.html');
        const resolvedPath = existsSync(htmlPath) ? htmlPath : htmlPathFallback;

        if (existsSync(resolvedPath)) {
          const html = readFileSync(resolvedPath, 'utf-8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } else {
          res.statusCode = 404;
          res.end('Not found');
        }
        return;
      }

      // Serve Admin Dashboard mini app (admin-only)
      if (pathname === '/admin') {
        const htmlPath = join(__dirname, 'webapp', 'admin.html');
        const htmlPathFallback = join(__dirname, '..', 'src', 'webapp', 'admin.html');
        const resolvedPath = existsSync(htmlPath) ? htmlPath : htmlPathFallback;

        if (existsSync(resolvedPath)) {
          const html = readFileSync(resolvedPath, 'utf-8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } else {
          res.statusCode = 404;
          res.end('Admin dashboard not found');
        }
        return;
      }

      // ── Admin API ─────────────────────────────────────────────
      if (pathname?.startsWith('/api/admin/')) {
        // Auth: require x-init-data header, parse telegramId, verify admin
        const initDataHeader = req.headers['x-init-data'] as string;
        if (!initDataHeader) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        let adminTelegramId: string | null = null;
        try {
          const params = new URLSearchParams(initDataHeader);
          const userJson = params.get('user');
          if (userJson) {
            const u = JSON.parse(decodeURIComponent(userJson));
            adminTelegramId = String(u.id);
          }
        } catch {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid initData' }));
          return;
        }

        if (!adminTelegramId || adminTelegramId !== config.telegram.adminChatId) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Forbidden: admin access only' }));
          return;
        }

        const jsonOk = (data: unknown) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        const jsonErr = (status: number, msg: string) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        };

        try {
          // GET /api/admin/stats
          if (pathname === '/api/admin/stats' && req.method === 'GET') {
            const stats = await adminApiService.getStats();
            jsonOk(stats);
            return;
          }

          // GET /api/admin/activity
          if (pathname === '/api/admin/activity' && req.method === 'GET') {
            const events = await adminApiService.getActivity(50);
            jsonOk({ events });
            return;
          }

          // GET /api/admin/transactions
          if (pathname === '/api/admin/transactions' && req.method === 'GET') {
            const page = parseInt(query.page as string) || 1;
            const limit = Math.min(parseInt(query.limit as string) || 10, 50);
            const status = query.status as string | undefined;
            const data = await adminApiService.getTransactions(page, limit, status);
            jsonOk(data);
            return;
          }

          // POST /api/admin/transactions/:id/approve
          const approveMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)\/approve$/);
          if (approveMatch && req.method === 'POST') {
            const txId = approveMatch[1];
            const { transactionService: txSvc } = await import('./services/transactionService');
            const tx = await txSvc.approve(txId, adminTelegramId, 'Approved via admin dashboard');
            const txWithUser = await txSvc.getById(txId);
            if (txWithUser) {
              await notificationService.notifyUserPaymentSent(
                (txWithUser as any).user.telegramId,
                tx
              );
            }
            await adminApiService.createAuditLog(
              adminTelegramId,
              'APPROVE_TRANSACTION',
              'transaction',
              txId,
              'Approved via admin dashboard'
            );
            jsonOk({ success: true });
            return;
          }

          // POST /api/admin/transactions/:id/cancel
          const cancelMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)\/cancel$/);
          if (cancelMatch && req.method === 'POST') {
            const txId = cancelMatch[1];
            const { transactionService: txSvc } = await import('./services/transactionService');
            const tx = await txSvc.cancel(txId, 'Cancelled via admin dashboard');
            const txWithUser = await txSvc.getById(txId);
            if (txWithUser) {
              await notificationService.notifyUserTransactionCancelled(
                (txWithUser as any).user.telegramId,
                tx,
                'Cancelled by admin'
              );
            }
            await adminApiService.createAuditLog(
              adminTelegramId,
              'CANCEL_TRANSACTION',
              'transaction',
              txId,
              'Cancelled via admin dashboard'
            );
            jsonOk({ success: true });
            return;
          }

          // GET /api/admin/users
          if (pathname === '/api/admin/users' && req.method === 'GET') {
            const page = parseInt(query.page as string) || 1;
            const limit = Math.min(parseInt(query.limit as string) || 15, 50);
            const filter = query.filter as string | undefined;
            const search = query.search as string | undefined;
            const data = await adminApiService.getUsers(page, limit, filter, search);
            jsonOk(data);
            return;
          }

          // POST /api/admin/users/:telegramId/ban
          const banMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/ban$/);
          if (banMatch && req.method === 'POST') {
            const targetId = banMatch[1];
            const { userService: uSvc } = await import('./services/userService');
            const user = await uSvc.findByTelegramId(targetId);
            if (!user) { jsonErr(404, 'User not found'); return; }
            await uSvc.setBanned(user.id, true);
            await adminApiService.createAuditLog(adminTelegramId, 'BAN_USER', 'user', user.id, `Banned via dashboard`);
            jsonOk({ success: true });
            return;
          }

          // POST /api/admin/users/:telegramId/unban
          const unbanMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/unban$/);
          if (unbanMatch && req.method === 'POST') {
            const targetId = unbanMatch[1];
            const { userService: uSvc } = await import('./services/userService');
            const user = await uSvc.findByTelegramId(targetId);
            if (!user) { jsonErr(404, 'User not found'); return; }
            await uSvc.setBanned(user.id, false);
            await adminApiService.createAuditLog(adminTelegramId, 'UNBAN_USER', 'user', user.id, `Unbanned via dashboard`);
            jsonOk({ success: true });
            return;
          }

          // GET /api/admin/audit-logs
          if (pathname === '/api/admin/audit-logs' && req.method === 'GET') {
            const logs = await adminApiService.getAuditLogs(100);
            jsonOk({ logs });
            return;
          }

          jsonErr(404, 'Admin API endpoint not found');
        } catch (error) {
          logger.error('Admin API error:', error);
          const msg = error instanceof Error ? error.message : 'Internal server error';
          jsonErr(500, msg);
        }
        return;
      }

      // Health check endpoint
      if (pathname === '/health') {
        let dbStatus = 'unknown';
        try {
          await prisma.$queryRaw`SELECT 1`;
          dbStatus = 'connected';
        } catch {
          dbStatus = 'disconnected';
        }

        res.statusCode = dbStatus === 'connected' ? 200 : 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: dbStatus === 'connected' ? 'ok' : 'degraded',
          database: dbStatus,
          ipn: config.ipn.enabled,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // Default 404
      res.statusCode = 404;
      res.end('Not found');
    });

    // Listen on all interfaces (0.0.0.0) for Render compatibility
    this.webhookServer.listen(port, '0.0.0.0', () => {
      const publicBase =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.SELF_URL ||
        `http://localhost:${port}`;
      const base = publicBase.replace(/\/$/, '');

      logger.info(`✅ Webhook server listening on 0.0.0.0:${port}`);
      logger.info(`IPN endpoint: ${base}${webhookService.getWebhookPath()}`);
      logger.info(`Health check: ${base}/health`);
      logger.info(`WebApp registration: ${base}/register`);
      logger.info(`Admin dashboard: ${base}/admin`);
      logger.info(`API banks: ${base}/api/banks`);
      logger.info(`API resolve-account: ${base}/api/resolve-account`);
    });

    this.webhookServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error('Webhook server error:', error);
      }
    });
  }

  private stop(signal: string) {
    logger.info(`Received ${signal}, shutting down...`);
    this.bot.stop(signal);
    
    // Close webhook server if running
    if (this.webhookServer) {
      this.webhookServer.close(() => {
        logger.info('Webhook server closed');
      });
    }
    
    prisma.$disconnect();
  }
}

// Start the bot
const bot = new CryptoBot();
bot.start();

export default bot;
