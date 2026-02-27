import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { userService } from '../../services/userService';
import { SessionState, getSession, setSession, clearSession, updateSessionData } from '../../utils/session';
import { getMainKeyboard, getBankSelectionKeyboard, getSettingsKeyboard } from '../../utils/keyboards';
import { BANKS } from '../../config';
import logger from '../../utils/logger';

type BotContext = Context<Update>;

export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);

  if (user?.isBanned) {
    await ctx.reply('⚠️ Your account has been suspended. Please contact support.');
    return;
  }

  if (user && userService.isRegistered(user)) {
    await ctx.reply(
      `👋 Welcome back, ${user.firstName}!\n\nYour account is already registered. What would you like to do?`,
      getMainKeyboard()
    );
    return;
  }

  // Start registration flow
  if (user) {
    setSession(telegramId, { state: SessionState.ENTERING_BANK });
    await ctx.reply(
      `👋 Welcome back, ${user.firstName}!\n\n` +
      `It looks like you haven't completed your registration.\n\n` +
      `Please select your bank:`,
      getBankSelectionKeyboard()
    );
    return;
  }

  // Create new user
  await userService.create({
    telegramId: String(telegramId),
    username: ctx.from?.username,
    firstName: ctx.from?.first_name || 'User',
    lastName: ctx.from?.last_name,
  });

  setSession(telegramId, { state: SessionState.ENTERING_BANK });

  await ctx.reply(
    `👋 Welcome to Crypto Exchange Bot!\n\n` +
    `To get started, you'll need to provide your bank details for receiving payments.\n\n` +
    `Please select your bank:`,
    getBankSelectionKeyboard()
  );
}

export async function handleBankSelection(ctx: BotContext, bankKey: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const bankName = bankKey.replace('bank_', '').replace(/_/g, ' ');
  updateSessionData(telegramId, { bankName });
  setSession(telegramId, { state: SessionState.ENTERING_ACCOUNT_NUMBER });

  await ctx.reply(
    `🏦 Bank: ${bankName}\n\n` +
    `Please enter your account number:`
  );
}

export async function handleAccountNumber(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_ACCOUNT_NUMBER) return;

  const accountNumber = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  
  if (!accountNumber || accountNumber.length < 5 || !/^\d+$/.test(accountNumber)) {
    await ctx.reply('⚠️ Please enter a valid account number (numbers only):');
    return;
  }

  updateSessionData(telegramId, { accountNumber });
  setSession(telegramId, { state: SessionState.ENTERING_NAME });

  await ctx.reply(
    `📱 Account Number: ${accountNumber}\n\n` +
    `Please enter the account holder's name:`
  );
}

export async function handleAccountName(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_NAME) return;

  const accountName = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  
  if (!accountName || accountName.length < 2) {
    await ctx.reply('⚠️ Please enter a valid account name:');
    return;
  }

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  await userService.updateBankDetails(user.id, {
    bankName: session.data.bankName as string,
    accountNumber: session.data.accountNumber as string,
    accountName,
  });

  clearSession(telegramId);

  await ctx.reply(
    `✅ Registration Complete!\n\n` +
    `🏦 Bank: ${session.data.bankName}\n` +
    `📱 Account: ${session.data.accountNumber}\n` +
    `👤 Name: ${accountName}\n\n` +
    `You can now sell crypto and receive payments to your bank account!`,
    getMainKeyboard()
  );
}

export async function handleSettings(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  const message = `
👤 <b>Your Settings</b>

🏦 <b>Bank:</b> ${user.bankName || 'Not set'}
📱 <b>Account Number:</b> ${user.accountNumber || 'Not set'}
👤 <b>Account Name:</b> ${user.accountName || 'Not set'}

Select what you'd like to update:
  `.trim();

  await ctx.reply(message, { parse_mode: 'HTML', ...getSettingsKeyboard() });
}

export async function handleUpdateBank(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setSession(telegramId, { state: SessionState.UPDATING_BANK });
  await ctx.reply('Select your new bank:', getBankSelectionKeyboard());
}

export async function handleUpdateAccount(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setSession(telegramId, { state: SessionState.UPDATING_ACCOUNT_NUMBER });
  await ctx.reply('Enter your new account number:');
}

export async function handleUpdateName(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setSession(telegramId, { state: SessionState.UPDATING_ACCOUNT_NAME });
  await ctx.reply("Enter the account holder's name:");
}

export async function handleSettingsUpdate(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  switch (session.state) {
    case SessionState.UPDATING_BANK:
      updateSessionData(telegramId, { bankName: text });
      await userService.update(user.id, { bankName: text });
      clearSession(telegramId);
      await ctx.reply(`✅ Bank updated to: ${text}`, getMainKeyboard());
      break;

    case SessionState.UPDATING_ACCOUNT_NUMBER:
      if (!text || !/^\d+$/.test(text)) {
        await ctx.reply('⚠️ Please enter a valid account number:');
        return;
      }
      await userService.update(user.id, { accountNumber: text });
      clearSession(telegramId);
      await ctx.reply(`✅ Account number updated!`, getMainKeyboard());
      break;

    case SessionState.UPDATING_ACCOUNT_NAME:
      if (!text || text.length < 2) {
        await ctx.reply('⚠️ Please enter a valid name:');
        return;
      }
      await userService.update(user.id, { accountName: text });
      clearSession(telegramId);
      await ctx.reply(`✅ Account name updated!`, getMainKeyboard());
      break;

    default:
      break;
  }
}

export async function handleDeleteAccount(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  await userService.delete(user.id);

  await ctx.reply(
    '✅ Your account has been deleted.\n\n' +
    'Use /start to register again if you change your mind.'
  );
}

export async function handleHelp(ctx: BotContext): Promise<void> {
  const message = `
📚 <b>Crypto Exchange Bot Help</b>

<b>How to Sell Crypto:</b>
1. Use /sell or tap "💰 Sell Crypto"
2. Select your cryptocurrency
3. Choose the network
4. Send crypto to the provided address
5. Wait for confirmation
6. Receive payment to your bank account

<b>Commands:</b>
/start - Register or start the bot
/sell - Start a new crypto sale
/balance - Check your balance
/history - View transaction history
/rates - View current crypto rates
/settings - Update your bank details
/referral - Get your referral link
/support - Contact support
/help - Show this help message

<b>FAQ:</b>
• Minimum deposit: $10
• Maximum deposit: $10,000
• Fee: 1.5%
• Processing time: Usually within 24 hours

Need more help? Contact support: /support
  `.trim();

  await ctx.reply(message, { parse_mode: 'HTML' });
}

export default {
  handleStart,
  handleBankSelection,
  handleAccountNumber,
  handleAccountName,
  handleSettings,
  handleUpdateBank,
  handleUpdateAccount,
  handleUpdateName,
  handleSettingsUpdate,
  handleDeleteAccount,
  handleHelp,
};
