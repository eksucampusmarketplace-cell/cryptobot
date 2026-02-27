import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { CRYPTO_CONFIG, BANKS } from '../config';

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

export function getCryptoSelectionKeyboard() {
  const buttons = Object.entries(CRYPTO_CONFIG).map(([symbol, info]) => [
    Markup.button.callback(`${info.name} (${symbol})`, `crypto_${symbol}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function getNetworkSelectionKeyboard(crypto: string) {
  const cryptoInfo = CRYPTO_CONFIG[crypto];
  if (!cryptoInfo) {
    return Markup.inlineKeyboard([]);
  }
  const buttons = cryptoInfo.networks.map((network) => [
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
