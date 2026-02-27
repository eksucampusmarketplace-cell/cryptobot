import { Context, MiddlewareFn } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { config } from '../../config';
import { userService } from '../../services/userService';
import logger from '../../utils/logger';

type BotContext = Context<Update>;

// Rate limiting store
const rateLimitStore = new Map<number, { count: number; resetTime: number }>();

export const rateLimitMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return next();

  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxMessages = config.rateLimit.maxMessages;

  const record = rateLimitStore.get(telegramId);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(telegramId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxMessages) {
    logger.warn(`Rate limit exceeded for user ${telegramId}`);
    await ctx.reply('⚠️ You\'re sending messages too fast. Please wait a moment.');
    return;
  }

  record.count++;
  return next();
};

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(id);
    }
  }
}, 60000);

export const authMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);

  if (user?.isBanned) {
    await ctx.reply('⚠️ Your account has been suspended. Please contact support.');
    return;
  }

  return next();
};

export const loggingMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || 'unknown';
  const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '[non-text]';

  logger.debug(`User ${telegramId} (@${username}): ${message}`);

  return next();
};

export const errorMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    logger.error('Bot error:', error);
    
    try {
      await ctx.reply(
        '❌ An unexpected error occurred. Please try again later.\n\n' +
        'If the problem persists, contact support: /support'
      );
    } catch {
      // Ignore if we can't send message
    }
  }
};

export default {
  rateLimitMiddleware,
  authMiddleware,
  loggingMiddleware,
  errorMiddleware,
};
