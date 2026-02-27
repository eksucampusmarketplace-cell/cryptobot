import * as dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'] as const;
const missingEnvVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
}

if (missingEnvVars.length > 0) {
  console.error(`\n❌ Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
  console.error('   Please set these in your Render dashboard or .env file');
  console.error('   Example DATABASE_URL: postgresql://user:password@host:5432/database\n');
  process.exit(1);
}

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.ADMIN_CHAT_ID || '',
  },
  
  crypto: {
    supportedCryptos: (process.env.SUPPORTED_CRYPTOS || 'BTC,ETH,USDT,USDC').split(','),
    minDepositUsd: parseFloat(process.env.MIN_DEPOSIT_USD || '10'),
    maxDepositUsd: parseFloat(process.env.MAX_DEPOSIT_USD || '10000'),
    exchangeFeePercent: parseFloat(process.env.EXCHANGE_FEE_PERCENT || '1.5'),
    useNowPayments: process.env.USE_NOWPAYMENTS !== 'false', // Default to true
  },
  
  apis: {
    blockcypher: process.env.BLOCKCYPHER_API_KEY || '',
    etherscan: process.env.ETHERSCAN_API_KEY || '',
    trongrid: process.env.TRONGRID_API_KEY || '',
    nowpayments: process.env.NOWPAYMENTS_API_KEY || '',
  },
  
  ipn: {
    secret: process.env.NOWPAYMENTS_IPN_SECRET || '',
    enabled: process.env.NOWPAYMENTS_IPN_ENABLED !== 'false',
    webhookUrl: process.env.WEBHOOK_URL || '',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    baseUrl: 'https://api.paystack.co',
  },

  webapp: {
    url: process.env.WEBAPP_URL || '',
  },
  
  wallet: {
    encryptionKey: process.env.WALLET_ENCRYPTION_KEY || 'default-key-change-in-production',
  },
  
  rateLimit: {
    maxMessages: parseInt(process.env.RATE_LIMIT_MESSAGES || '5'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  },
  
  notifications: {
    adminNotifications: process.env.ADMIN_NOTIFICATIONS === 'true',
    userNotifications: process.env.USER_NOTIFICATIONS !== 'false',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
};

// Base crypto config - will be extended with NOWPayments data
export const CRYPTO_CONFIG: Record<string, {
  name: string;
  symbol: string;
  networks: string[];
  confirmations: number;
  minAmount: number;
  logoUrl?: string;
  priority?: number;
  isPopular?: boolean;
}> = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    networks: ['mainnet', 'testnet'],
    confirmations: 3,
    minAmount: 0.0001,
    priority: 0,
    isPopular: true,
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    networks: ['erc20'],
    confirmations: 12,
    minAmount: 0.001,
    priority: 1,
    isPopular: true,
  },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    networks: ['erc20', 'trc20', 'bep20'],
    confirmations: 12,
    minAmount: 1,
    priority: 2,
    isPopular: true,
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    networks: ['erc20', 'trc20', 'bep20'],
    confirmations: 12,
    minAmount: 1,
    priority: 3,
    isPopular: true,
  },
  BNB: {
    name: 'BNB',
    symbol: 'BNB',
    networks: ['bep20'],
    confirmations: 15,
    minAmount: 0.01,
    priority: 4,
    isPopular: true,
  },
  TRX: {
    name: 'Tron',
    symbol: 'TRX',
    networks: ['trc20'],
    confirmations: 19,
    minAmount: 10,
    priority: 9,
    isPopular: true,
  },
};

export const BANKS = [
  'Bank of America',
  'Chase Bank',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'TD Bank',
  'PNC Bank',
  'US Bank',
  'Other',
];

export const ADMIN_COMMANDS = [
  { command: '/admin', description: 'Access admin panel' },
  { command: '/dashboard', description: 'Open admin dashboard mini app' },
  { command: '/pending', description: 'View pending transactions' },
  { command: '/users', description: 'View all users' },
  { command: '/stats', description: 'View bot statistics' },
  { command: '/broadcast', description: 'Send message to all users' },
];

export const USER_COMMANDS = [
  { command: '/start', description: 'Start the bot and register' },
  { command: '/sell', description: 'Start a new crypto sale' },
  { command: '/balance', description: 'Check your balance' },
  { command: '/history', description: 'View transaction history' },
  { command: '/rates', description: 'View current crypto rates' },
  { command: '/settings', description: 'Update your settings' },
  { command: '/referral', description: 'Get your referral link' },
  { command: '/support', description: 'Contact support' },
  { command: '/help', description: 'Get help' },
];
