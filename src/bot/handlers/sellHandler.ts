import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { userService } from '../../services/userService';
import { walletService } from '../../services/walletService';
import { transactionService } from '../../services/transactionService';
import cryptoService from '../../services/cryptoService';
import nowpaymentsService from '../../services/nowpaymentsService';
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

  const keyboard = await getCryptoSelectionKeyboard();
  
  await ctx.reply(
    '💰 <b>Sell Crypto</b>\n\n' +
    'Select the cryptocurrency you want to sell:\n\n' +
    '⭐ = Popular coins',
    { parse_mode: 'HTML', ...keyboard }
  );
}

export async function handleCryptoSelection(ctx: Context, crypto: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.SELECTING_CRYPTO) {
    await ctx.reply(
      '⚠️ Your session has expired. Please start a new transaction.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    return;
  }

  updateSessionData(telegramId, { crypto });
  setSession(telegramId, { state: SessionState.SELECTING_NETWORK });

  // Try to get crypto info from NOWPayments first
  let cryptoInfo = CRYPTO_CONFIG[crypto];
  let networks: string[] = cryptoInfo?.networks || ['mainnet'];
  let cryptoName = cryptoInfo?.name || crypto;
  
  if (config.crypto.useNowPayments && config.apis.nowpayments) {
    try {
      const npConfig = await nowpaymentsService.getCryptoConfig();
      if (npConfig[crypto]) {
        networks = npConfig[crypto].networks;
        cryptoName = npConfig[crypto].name;
      }
    } catch (error) {
      // Use fallback config
    }
  }
  
  await ctx.reply(
    `💰 Selected: <b>${cryptoName} (${crypto})</b>\n\n` +
    `Select the network:`,
    { parse_mode: 'HTML', ...getNetworkSelectionKeyboard(crypto, networks) }
  );
}

export async function handleNetworkSelection(ctx: Context, network: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  
  // Check if user is in the correct state
  if (session.state !== SessionState.SELECTING_NETWORK) {
    await ctx.reply(
      '⚠️ Your session has expired. Please start a new transaction.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    return;
  }
  
  // Validate that crypto was selected
  const crypto = session.data.crypto as string;
  if (!crypto) {
    logger.warn(`Session missing crypto data for user ${telegramId}`);
    await ctx.reply(
      '⚠️ Session error: cryptocurrency not selected. Please start over.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    clearSession(telegramId);
    return;
  }

  updateSessionData(telegramId, { network });
  setSession(telegramId, { state: SessionState.ENTERING_AMOUNT });
  
  // Get crypto info from NOWPayments or fallback
  let minAmount = 0.01;
  let cryptoName = crypto;
  
  if (config.crypto.useNowPayments && config.apis.nowpayments) {
    try {
      const npConfig = await nowpaymentsService.getCryptoConfig();
      if (npConfig[crypto]) {
        minAmount = npConfig[crypto].minAmount;
        cryptoName = npConfig[crypto].name;
      } else if (CRYPTO_CONFIG[crypto]) {
        minAmount = CRYPTO_CONFIG[crypto].minAmount;
        cryptoName = CRYPTO_CONFIG[crypto].name;
      }
    } catch (error) {
      if (CRYPTO_CONFIG[crypto]) {
        minAmount = CRYPTO_CONFIG[crypto].minAmount;
        cryptoName = CRYPTO_CONFIG[crypto].name;
      }
    }
  } else if (CRYPTO_CONFIG[crypto]) {
    minAmount = CRYPTO_CONFIG[crypto].minAmount;
    cryptoName = CRYPTO_CONFIG[crypto].name;
  }
  
  const rate = await cryptoService.getCryptoRate(crypto);

  await ctx.reply(
    `🌐 Network: <b>${network.toUpperCase()}</b>\n\n` +
    `Selected: <b>${cryptoName} (${crypto})</b>\n` +
    `Current rate: 1 ${crypto} = ${rate?.priceUsd.toFixed(2) || 'N/A'}\n` +
    `Minimum: ${minAmount} ${crypto}\n\n` +
    `Enter the amount of ${crypto} you want to sell:`,
    { parse_mode: 'HTML' }
  );
}

export async function handleAmountEntry(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.state !== SessionState.ENTERING_AMOUNT) {
    await ctx.reply(
      '⚠️ Your session has expired. Please start a new transaction.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    return;
  }

  // Validate required session data
  const crypto = session.data.crypto as string;
  const network = session.data.network as string;
  if (!crypto || !network) {
    logger.warn(`Session missing data for user ${telegramId}: crypto=${crypto}, network=${network}`);
    await ctx.reply(
      '⚠️ Session error. Please start over.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    clearSession(telegramId);
    return;
  }

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const amount = parseFloat(text);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('⚠️ Please enter a valid amount:');
    return;
  }
  
  // Get min amount from NOWPayments or fallback
  let minAmount = 0.01;
  
  if (config.crypto.useNowPayments && config.apis.nowpayments) {
    try {
      const npConfig = await nowpaymentsService.getCryptoConfig();
      if (npConfig[crypto]) {
        minAmount = npConfig[crypto].minAmount;
      } else if (CRYPTO_CONFIG[crypto]) {
        minAmount = CRYPTO_CONFIG[crypto].minAmount;
      }
    } catch (error) {
      if (CRYPTO_CONFIG[crypto]) {
        minAmount = CRYPTO_CONFIG[crypto].minAmount;
      }
    }
  } else if (CRYPTO_CONFIG[crypto]) {
    minAmount = CRYPTO_CONFIG[crypto].minAmount;
  }

  if (amount < minAmount) {
    await ctx.reply(`⚠️ Minimum amount is ${minAmount} ${crypto}. Please enter a higher amount:`);
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
  if (session.state !== SessionState.CONFIRMING_SALE) {
    await ctx.reply(
      '⚠️ Your session has expired. Please start a new transaction.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    return;
  }

  const user = await userService.findByTelegramId(telegramId);
  if (!user) return;

  const { crypto, network, amount } = session.data as {
    crypto: string;
    network: string;
    amount: number;
  };
  
  // Validate required data
  if (!crypto || !network || !amount) {
    logger.warn(`Session missing data for confirm sale: user ${telegramId}`);
    await ctx.reply(
      '⚠️ Session error. Please start over.\n\nUse /sell to try again.',
      getMainKeyboard()
    );
    clearSession(telegramId);
    return;
  }

  try {
    // Get required confirmations from NOWPayments or fallback
    let confirmations = 3;
    
    if (config.crypto.useNowPayments && config.apis.nowpayments) {
      try {
        const npConfig = await nowpaymentsService.getCryptoConfig();
        if (npConfig[crypto]) {
          confirmations = npConfig[crypto].confirmations;
        } else if (CRYPTO_CONFIG[crypto]) {
          confirmations = CRYPTO_CONFIG[crypto].confirmations;
        }
      } catch (error) {
        if (CRYPTO_CONFIG[crypto]) {
          confirmations = CRYPTO_CONFIG[crypto].confirmations;
        }
      }
    } else if (CRYPTO_CONFIG[crypto]) {
      confirmations = CRYPTO_CONFIG[crypto].confirmations;
    }
    
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
      requiredConfirmations: confirmations,
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
      `• Required confirmations: ${confirmations}\n\n` +
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
