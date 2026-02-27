import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { userService } from '../../services/userService';
import { walletService } from '../../services/walletService';
import { transactionService } from '../../services/transactionService';
import cryptoService from '../../services/cryptoService';
import { SessionState, getSession, setSession, clearSession, updateSessionData } from '../../utils/session';
import { 
  getMainKeyboard, 
  getCryptoSelectionKeyboard, 
  getNetworkSelectionKeyboard,
  getConfirmationKeyboard 
} from '../../utils/keyboards';
import { CRYPTO_CONFIG, config } from '../../config';
import logger from '../../utils/logger';

type BotContext = Context<Update>;

export async function handleSell(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  if (user.isBanned) {
    await ctx.reply('⚠️ Your account has been suspended. Please contact support.');
    return;
  }

  if (!userService.isRegistered(user)) {
    await ctx.reply(
      '⚠️ Please complete your registration first.\n\n' +
      'Use /start to add your bank details.',
      getMainKeyboard()
    );
    return;
  }

  setSession(telegramId, { state: SessionState.SELECTING_CRYPTO, data: {} });

  await ctx.reply(
    '💰 <b>Sell Crypto</b>\n\n' +
    'Select the cryptocurrency you want to sell:',
    { parse_mode: 'HTML', ...getCryptoSelectionKeyboard() }
  );
}

export async function handleCryptoSelection(ctx: Context, crypto: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.SELECTING_CRYPTO) return;

  updateSessionData(telegramId, { crypto });
  setSession(telegramId, { state: SessionState.SELECTING_NETWORK });

  const cryptoInfo = CRYPTO_CONFIG[crypto];
  await ctx.reply(
    `💰 Selected: <b>${cryptoInfo.name} (${crypto})</b>\n\n` +
    `Select the network:`,
    { parse_mode: 'HTML', ...getNetworkSelectionKeyboard(crypto) }
  );
}

export async function handleNetworkSelection(ctx: Context, network: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.SELECTING_NETWORK) return;

  updateSessionData(telegramId, { network });
  setSession(telegramId, { state: SessionState.ENTERING_AMOUNT });

  const cryptoInfo = CRYPTO_CONFIG[session.data.crypto as string];
  const rate = await cryptoService.getCryptoRate(session.data.crypto as string);

  await ctx.reply(
    `🌐 Network: <b>${network.toUpperCase()}</b>\n\n` +
    `Current rate: 1 ${session.data.crypto} = $${rate?.priceUsd.toFixed(2) || 'N/A'}\n` +
    `Minimum: ${cryptoInfo.minAmount} ${session.data.crypto}\n\n` +
    `Enter the amount of ${session.data.crypto} you want to sell:`,
    { parse_mode: 'HTML' }
  );
}

export async function handleAmountEntry(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_AMOUNT) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const amount = parseFloat(text);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('⚠️ Please enter a valid amount:');
    return;
  }

  const crypto = session.data.crypto as string;
  const cryptoInfo = CRYPTO_CONFIG[crypto];

  if (amount < cryptoInfo.minAmount) {
    await ctx.reply(`⚠️ Minimum amount is ${cryptoInfo.minAmount} ${crypto}. Please enter a higher amount:`);
    return;
  }

  // Calculate USD value
  const rate = await cryptoService.getCryptoRate(crypto);
  const priceUsd = rate?.priceUsd || 0;
  const exchange = cryptoService.calculateExchange(amount, crypto, priceUsd);

  // Check limits
  if (exchange.grossUsd < config.crypto.minDepositUsd) {
    await ctx.reply(`⚠️ Minimum deposit is $${config.crypto.minDepositUsd}. Please enter a higher amount:`);
    return;
  }

  if (exchange.grossUsd > config.crypto.maxDepositUsd) {
    await ctx.reply(`⚠️ Maximum deposit is $${config.crypto.maxDepositUsd}. Please enter a lower amount:`);
    return;
  }

  updateSessionData(telegramId, { amount, ...exchange });
  setSession(telegramId, { state: SessionState.CONFIRMING_SALE });

  const user = await userService.findByTelegramId(telegramId);

  await ctx.reply(
    `📋 <b>Transaction Summary</b>\n\n` +
    `💰 Amount: ${amount} ${crypto}\n` +
    `💵 USD Value: $${exchange.grossUsd.toFixed(2)}\n` +
    `📊 Rate: $${priceUsd.toFixed(2)} per ${crypto}\n` +
    `📉 Fee (${exchange.feePercent}%): -$${exchange.feeUsd.toFixed(2)}\n` +
    `✅ You'll receive: $${exchange.netUsd.toFixed(2)}\n\n` +
    `🏦 Bank: ${user?.bankName}\n` +
    `📱 Account: ${user?.accountNumber}\n` +
    `👤 Name: ${user?.accountName}\n\n` +
    `Do you want to proceed?`,
    { parse_mode: 'HTML', ...getConfirmationKeyboard('new') }
  );
}

export async function handleConfirmSale(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.CONFIRMING_SALE) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  const { crypto, network, amount } = session.data as {
    crypto: string;
    network: string;
    amount: number;
  };

  try {
    // Generate or get existing wallet
    const wallet = await walletService.getOrCreateForTransaction(user.id, crypto, network);

    // Create pending transaction
    const transaction = await transactionService.create({
      userId: user.id,
      walletId: wallet.id,
      type: 'EXCHANGE',
      cryptocurrency: crypto,
      network: network,
      amount: amount,
      toAddress: wallet.address,
      bankName: user.bankName || undefined,
      accountNumber: user.accountNumber || undefined,
      accountName: user.accountName || undefined,
    });

    clearSession(telegramId);

    // Show deposit instructions
    await ctx.reply(
      `✅ <b>Transaction Created!</b>\n\n` +
      `📝 Transaction ID: <code>${transaction.id}</code>\n\n` +
      `📥 <b>Send exactly ${amount} ${crypto} to:</b>\n` +
      `<code>${wallet.address}</code>\n\n` +
      `⚠️ <b>Important:</b>\n` +
      `• Send only ${crypto} to this address\n` +
      `• Network: ${network.toUpperCase()}\n` +
      `• Required confirmations: ${CRYPTO_CONFIG[crypto].confirmations}\n\n` +
      `We'll notify you once the deposit is confirmed.\n\n` +
      `⏳ Waiting for deposit...`,
      { parse_mode: 'HTML' }
    );

    // Show the address for copying
    await ctx.reply(
      `📋 Copy this address:\n\n<code>${wallet.address}</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    logger.error('Error creating transaction:', error);
    await ctx.reply(
      '❌ An error occurred. Please try again later.',
      getMainKeyboard()
    );
  }
}

export async function handleCancelSale(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  clearSession(telegramId);
  await ctx.reply('❌ Transaction cancelled.', getMainKeyboard());
}

export async function handleRates(ctx: Context): Promise<void> {
  const rates = await cryptoService.getAllRates();

  if (rates.length === 0) {
    await ctx.reply('Unable to fetch rates. Please try again later.');
    return;
  }

  let message = '📊 <b>Current Crypto Rates</b>\n\n';

  for (const rate of rates) {
    const changeIcon = rate.change24h >= 0 ? '📈' : '📉';
    const changeStr = rate.change24h >= 0 ? `+${rate.change24h.toFixed(2)}` : rate.change24h.toFixed(2);
    message += `${rate.symbol}: $${rate.priceUsd.toFixed(2)} ${changeIcon} ${changeStr}%\n`;
  }

  message += '\n💎 Fee: ' + config.crypto.exchangeFeePercent + '%';

  await ctx.reply(message, { parse_mode: 'HTML' });
}

export async function handleBalance(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  const volume = await transactionService.getUserVolume(user.id);

  await ctx.reply(
    `👤 <b>Your Account</b>\n\n` +
    `📊 Total Transactions: ${volume.totalTransactions}\n` +
    `💰 Total Volume: $${volume.totalVolumeUsd.toFixed(2)}\n` +
    `💸 Fees Paid: $${volume.totalFeesPaid.toFixed(2)}\n\n` +
    `🏦 Bank: ${user.bankName || 'Not set'}\n` +
    `📱 Account: ${user.accountNumber || 'Not set'}`,
    { parse_mode: 'HTML' }
  );
}

export async function handleHistory(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await userService.findByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Please use /start to register first.');
    return;
  }

  const { transactions } = await transactionService.getByUser(user.id, 1, 10);

  if (transactions.length === 0) {
    await ctx.reply('📭 No transactions found.');
    return;
  }

  let message = '📜 <b>Your Transactions</b>\n\n';

  for (const tx of transactions) {
    const statusEmoji = {
      PENDING: '⏳',
      CONFIRMING: '🔄',
      CONFIRMED: '✅',
      COMPLETED: '🎉',
      CANCELLED: '❌',
      FAILED: '⚠️',
      PROCESSING: '🔄',
      REFUNDED: '↩️',
    }[tx.status] || '❓';

    message += `${statusEmoji} ${tx.amount} ${tx.cryptocurrency} - $${tx.netAmount?.toFixed(2) || 'N/A'}\n`;
    message += `   ${tx.status} • ${new Date(tx.createdAt).toLocaleDateString()}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
}

export default {
  handleSell,
  handleCryptoSelection,
  handleNetworkSelection,
  handleAmountEntry,
  handleConfirmSale,
  handleCancelSale,
  handleRates,
  handleBalance,
  handleHistory,
};
