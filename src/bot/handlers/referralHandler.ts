import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { prisma } from '../../utils/db';
import { userService } from '../../services/userService';
import { config } from '../../config';
import logger from '../../utils/logger';

type BotContext = Context<Update>;

const REFERRAL_BONUS_PERCENT = 0.5; // 0.5% of referee's first transaction

export async function handleReferral(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  // Get referral stats
  const referrals = await prisma.referral.findMany({
    where: { referrerId: user.id },
    include: {
      referred: {
        select: { firstName: true, createdAt: true },
      },
    },
  });

  const totalBonus = referrals.reduce((sum, r) => sum + (r.bonusAmount || 0), 0);
  const paidBonus = referrals.filter((r) => r.bonusPaid).reduce((sum, r) => sum + (r.bonusAmount || 0), 0);

  // Generate referral link
  const botUsername = ctx.botInfo?.username || 'YourBot';
  const referralLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

  await ctx.reply(
    `🎁 <b>Referral Program</b>\n\n` +
    `Share your referral link and earn ${REFERRAL_BONUS_PERCENT}% of your friends' first transaction!\n\n` +
    `🔗 <b>Your Link:</b>\n<code>${referralLink}</code>\n\n` +
    `📊 <b>Your Stats:</b>\n` +
    `• Referrals: ${referrals.length}\n` +
    `• Total Bonus: $${totalBonus.toFixed(2)}\n` +
    `• Paid Out: $${paidBonus.toFixed(2)}\n\n` +
    `How it works:\n` +
    `1. Share your link with friends\n` +
    `2. They register and make their first transaction\n` +
    `3. You earn ${REFERRAL_BONUS_PERCENT}% of their transaction amount!`,
    { parse_mode: 'HTML' }
  );
}

export async function handleReferralStart(ctx: Context, referrerId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Can't refer yourself
  if (String(telegramId) === referrerId) {
    return;
  }

  const referrer = await userService.findByTelegramId(referrerId);
  if (!referrer) {
    logger.warn(`Referrer not found: ${referrerId}`);
    return;
  }

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  // Check if already has a referrer
  const existingReferral = await prisma.referral.findFirst({
    where: { referredId: user.id },
  });

  if (existingReferral) {
    return; // Already referred
  }

  // Create referral
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: user.id,
    },
  });

  logger.info(`New referral: ${telegramId} referred by ${referrerId}`);
}

export async function processReferralBonus(
  userId: string,
  transactionAmountUsd: number
): Promise<void> {
  const referral = await prisma.referral.findFirst({
    where: { referredId: userId },
    include: { referrer: true },
  });

  if (!referral || referral.bonusPaid) return;

  const bonusAmount = transactionAmountUsd * (REFERRAL_BONUS_PERCENT / 100);

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      bonusAmount,
      bonusPaid: true,
    },
  });

  // Notify referrer
  const { default: notificationService } = await import('../../services/notificationService');
  await notificationService.sendToUser(
    referral.referrer.telegramId,
    `🎁 <b>Referral Bonus!</b>\n\n` +
    `You earned ${bonusAmount.toFixed(2)} from your referral!\n\n` +
    `Keep sharing your referral link to earn more!`,
    'HTML'
  );

  logger.info(`Referral bonus: ${bonusAmount.toFixed(2)} to user ${referral.referrerId}`);
}

export default {
  handleReferral,
  handleReferralStart,
  processReferralBonus,
};
