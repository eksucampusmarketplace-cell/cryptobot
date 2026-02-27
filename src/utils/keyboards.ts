import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { CRYPTO_CONFIG, BANKS, config } from '../config';
import nowpaymentsService, { CryptoConfigItem } from '../services/nowpaymentsService';

export function getMainKeyboard() {
  return Markup.keyboard([
    ['💰 Sell Crypto', '📊 Rates'],
    ['📜 History', '👤 Settings'],
    ['🎁 Referral', '📞 Support'],
    ['❓ Help'],
  ]).resize().oneTime();
}

export function getAdminKeyboard() {
  return Markup.keyboard([
    ['📋 Pending Transactions', '👥 Users'],
    ['📊 Statistics', '📢 Broadcast'],
    ['⚙️ Settings', '🔙 Back to User Mode'],
  ]).resize().oneTime();
}

/**
 * Get crypto selection keyboard with popular coins first
 * Uses NOWPayments API if enabled, otherwise falls back to CRYPTO_CONFIG
 */
export async function getCryptoSelectionKeyboard(): Promise<ReturnType<typeof Markup.inlineKeyboard>> {
  // Try to get from NOWPayments if enabled
  if (config.crypto.useNowPayments && config.apis.nowpayments) {
    try {
      const currencies = await nowpaymentsService.getSortedCurrencies();
      
      if (currencies.length > 0) {
        const buttons: InlineKeyboardButton[][] = [];
        let currentRow: InlineKeyboardButton[] = [];
        
        for (const currency of currencies) {
          const emoji = currency.isPopular ? '⭐ ' : '';
          const button = Markup.button.callback(
            `${emoji}${currency.name} (${currency.symbol})`,
            `crypto_${currency.symbol}`
          );
          
          currentRow.push(button);
          
          // Create a new row after every 2 buttons for better mobile display
          if (currentRow.length === 2) {
            buttons.push(currentRow);
            currentRow = [];
          }
        }
        
        // Add any remaining buttons
        if (currentRow.length > 0) {
          buttons.push(currentRow);
        }
        
        return Markup.inlineKeyboard(buttons);
      }
    } catch (error) {
      // Fall back to default config
    }
  }
  
  // Fallback to static CRYPTO_CONFIG, sorted by priority
  const sortedEntries = Object.entries(CRYPTO_CONFIG)
    .sort(([, a], [, b]) => (a.priority || 999) - (b.priority || 999));
    
  const buttons: InlineKeyboardButton[][] = [];
  let currentRow: InlineKeyboardButton[] = [];
  
  for (const [symbol, info] of sortedEntries) {
    const emoji = info.isPopular ? '⭐ ' : '';
    const button = Markup.button.callback(
      `${emoji}${info.name} (${symbol})`,
      `crypto_${symbol}`
    );
    
    currentRow.push(button);
    
    if (currentRow.length === 2) {
      buttons.push(currentRow);
      currentRow = [];
    }
  }
  
  if (currentRow.length > 0) {
    buttons.push(currentRow);
  }
  
  return Markup.inlineKeyboard(buttons);
}

/**
 * Get crypto selection keyboard synchronously (fallback only)
 * Use getCryptoSelectionKeyboard() for full functionality
 */
export function getCryptoSelectionKeyboardSync(): ReturnType<typeof Markup.inlineKeyboard> {
  const sortedEntries = Object.entries(CRYPTO_CONFIG)
    .sort(([, a], [, b]) => (a.priority || 999) - (b.priority || 999));
    
  const buttons: InlineKeyboardButton[][] = [];
  let currentRow: InlineKeyboardButton[] = [];
  
  for (const [symbol, info] of sortedEntries) {
    const emoji = info.isPopular ? '⭐ ' : '';
    const button = Markup.button.callback(
      `${emoji}${info.name} (${symbol})`,
      `crypto_${symbol}`
    );
    
    currentRow.push(button);
    
    if (currentRow.length === 2) {
      buttons.push(currentRow);
      currentRow = [];
    }
  }
  
  if (currentRow.length > 0) {
    buttons.push(currentRow);
  }
  
  return Markup.inlineKeyboard(buttons);
}

/**
 * Get network selection keyboard for a cryptocurrency
 */
export function getNetworkSelectionKeyboard(crypto: string, networks?: string[]): ReturnType<typeof Markup.inlineKeyboard> {
  // Use provided networks or fall back to config
  let networkList = networks;
  
  if (!networkList) {
    const cryptoInfo = CRYPTO_CONFIG[crypto];
    if (!cryptoInfo) {
      return Markup.inlineKeyboard([]);
    }
    networkList = cryptoInfo.networks;
  }
  
  const buttons = networkList.map((network) => [
    Markup.button.callback(network.toUpperCase(), `network_${network}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function getBankSelectionKeyboard() {
  const buttons = BANKS.map((bank) => [
    Markup.button.callback(bank, `bank_${bank.replace(/\s+/g, '_')}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function getConfirmationKeyboard(transactionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', `confirm_${transactionId}`),
      Markup.button.callback('❌ Cancel', `cancel_${transactionId}`),
    ],
  ]);
}

export function getTransactionActionKeyboard(transactionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Mark as Paid', `tx_paid_${transactionId}`),
      Markup.button.callback('🔄 Processing', `tx_process_${transactionId}`),
    ],
    [
      Markup.button.callback('❌ Cancel', `tx_cancel_${transactionId}`),
      Markup.button.callback('💬 Contact User', `tx_contact_${transactionId}`),
    ],
  ]);
}

export function getSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏦 Update Bank', 'settings_bank')],
    [Markup.button.callback('📱 Update Account Number', 'settings_account')],
    [Markup.button.callback('👤 Update Account Name', 'settings_name')],
    [Markup.button.callback('🗑️ Delete Account', 'settings_delete')],
  ]);
}

export function getBackKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back', 'back')],
  ]);
}

export function getPaginationKeyboard(
  prefix: string,
  currentPage: number,
  totalPages: number,
  extraButtons: InlineKeyboardButton[][] = []
) {
  const buttons: InlineKeyboardButton[][] = [...extraButtons];
  const navButtons: InlineKeyboardButton[] = [];

  if (currentPage > 1) {
    navButtons.push(Markup.button.callback('⬅️ Previous', `${prefix}_page_${currentPage - 1}`));
  }
  navButtons.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'noop'));
  if (currentPage < totalPages) {
    navButtons.push(Markup.button.callback('➡️ Next', `${prefix}_page_${currentPage + 1}`));
  }

  buttons.push(navButtons);
  return Markup.inlineKeyboard(buttons);
}

export function getSupportTicketKeyboard(ticketId: string, isAdmin: boolean = false) {
  if (isAdmin) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('💬 Reply', `ticket_reply_${ticketId}`),
        Markup.button.callback('✅ Resolve', `ticket_resolve_${ticketId}`),
      ],
      [
        Markup.button.callback('🔒 Close', `ticket_close_${ticketId}`),
      ],
    ]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback('💬 Reply', `ticket_reply_${ticketId}`)],
    [Markup.button.callback('✅ Mark Resolved', `ticket_resolve_${ticketId}`)],
  ]);
}
