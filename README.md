# CryptoBot - Telegram Crypto Exchange Bot

A comprehensive Telegram bot for cryptocurrency exchange with bank transfer payouts. Users can sell crypto and receive payments directly to their bank accounts.

## 🌟 Features

### User Features
- **User Registration**: Simple onboarding with bank details collection
- **Multi-Crypto Support**: 100+ cryptocurrencies via NOWPayments API
- **Popular Coins First**: BTC, ETH, USDT, USDC, BNB, XRP, ADA, DOGE, SOL, TRX, and more
- **Multi-Network Support**: ERC20, TRC20, BEP20, Native chains
- **Real-time Rates**: Live cryptocurrency prices with 24h changes
- **Automatic Deposit Detection**: Bot monitors blockchain for incoming deposits
- **Transaction History**: View all past transactions
- **Referral System**: Earn 0.5% of referral's first transaction
- **Support Tickets**: Built-in support system
- **Settings Management**: Update bank details anytime

### Admin Features
- **Admin Panel**: Full control dashboard
- **Pending Transactions**: View and manage pending payouts
- **User Management**: View, search, ban/unban users
- **Statistics**: Real-time bot metrics
- **Broadcast Messages**: Send announcements to all users
- **Manual Payout Confirmation**: Mark transactions as paid after bank transfer

### Technical Features
- **Rate Limiting**: Prevent spam and abuse
- **Session Management**: Handle multi-step conversations
- **Automatic Confirmations**: Track blockchain confirmations
- **Error Handling**: Comprehensive error logging
- **Audit Logging**: Track all admin actions

## 📋 Prerequisites

- Node.js 18+ 
- SQLite (default) or PostgreSQL
- Telegram Bot Token (from @BotFather)
- NOWPayments API Key (for 100+ cryptocurrency support)
- (Optional) API Keys for blockchain monitoring:
  - BlockCypher API (for Bitcoin)
  - Etherscan API (for Ethereum/ERC20)
  - TronGrid API (for Tron/TRC20)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-repo/cryptobot.git
cd cryptobot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_telegram_id_here

# Required - NOWPayments (for 100+ coin support)
NOWPAYMENTS_API_KEY=your_nowpayments_api_key

# Optional - Blockchain APIs (fallback/manual tracking)
BLOCKCYPHER_API_KEY=your_key
ETHERSCAN_API_KEY=your_key
TRONGRID_API_KEY=your_key
```

### 3. Get Your Telegram Chat ID

1. Start a chat with @userinfobot on Telegram
2. It will reply with your chat ID
3. Add this to `ADMIN_CHAT_ID` in `.env`

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Start the Bot

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📱 Bot Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/start` | Register or restart the bot |
| `/sell` | Start a new crypto sale |
| `/rates` | View current crypto prices |
| `/balance` | Check your balance and stats |
| `/history` | View transaction history |
| `/settings` | Update bank details |
| `/referral` | Get your referral link |
| `/support` | Create support ticket |
| `/help` | Show help message |

### Admin Commands
| Command | Description |
|---------|-------------|
| `/admin` | Open admin panel |
| `/pending` | View pending transactions |
| `/users` | View all users |
| `/stats` | View bot statistics |
| `/broadcast` | Send message to all users |

## 💱 How It Works

### User Flow

1. **Registration**
   - User sends `/start`
   - Bot collects bank name, account number, account holder name
   - User is now verified and can trade

2. **Sell Crypto**
   - User selects cryptocurrency
   - User selects network (ERC20, TRC20, etc.)
   - User enters amount
   - Bot generates deposit address
   - User sends crypto to address

3. **Deposit Detection**
   - Bot monitors blockchain automatically
   - Detects incoming transaction
   - Waits for required confirmations
   - Notifies user and admin

4. **Payout**
   - Admin receives notification
   - Admin sends bank transfer manually
   - Admin marks transaction as paid
   - User receives confirmation

## 🔧 Configuration

### Exchange Settings

```env
EXCHANGE_FEE_PERCENT=1.5      # Fee percentage
MIN_DEPOSIT_USD=10            # Minimum deposit in USD
MAX_DEPOSIT_USD=10000         # Maximum deposit in USD
```

### Supported Cryptocurrencies

With NOWPayments integration, the bot supports 100+ cryptocurrencies including:

**Popular Coins (shown first):**
- BTC (Bitcoin) - Native, Testnet
- ETH (Ethereum) - ERC20
- USDT (Tether) - ERC20, TRC20, BEP20
- USDC (USD Coin) - ERC20, TRC20, BEP20
- BNB (BNB) - BEP20
- XRP (XRP) - Native
- ADA (Cardano) - Native
- DOGE (Dogecoin) - Native
- SOL (Solana) - Native
- TRX (Tron) - TRC20
- DOT (Polkadot) - Native
- MATIC (Polygon) - ERC20
- LTC (Litecoin) - Native
- And many more...

To configure manually (without NOWPayments), set in `.env`:
```env
SUPPORTED_CRYPTOS=BTC,ETH,USDT,USDC
USE_NOWPAYMENTS=false
```

### Rate Limiting

```env
RATE_LIMIT_MESSAGES=5         # Max messages per window
RATE_LIMIT_WINDOW_MS=60000    # Window in milliseconds
```

## 🗂️ Project Structure

```
cryptobot/
├── src/
│   ├── bot/
│   │   ├── handlers/
│   │   │   ├── userHandler.ts      # User registration & settings
│   │   │   ├── sellHandler.ts      # Sell crypto flow
│   │   │   ├── adminHandler.ts     # Admin commands
│   │   │   ├── supportHandler.ts   # Support tickets
│   │   │   ├── referralHandler.ts  # Referral system
│   │   │   └── callbackHandler.ts  # Inline keyboard callbacks
│   │   └── middleware/
│   │       └── index.ts            # Rate limiting, auth, logging
│   ├── services/
│   │   ├── cryptoService.ts        # Blockchain interactions
│   │   ├── userService.ts          # User management
│   │   ├── transactionService.ts   # Transaction management
│   │   ├── walletService.ts        # Wallet generation
│   │   └── notificationService.ts  # Telegram notifications
│   ├── workers/
│   │   └── depositChecker.ts       # Background deposit monitoring
│   ├── config/
│   │   └── index.ts                # App configuration
│   ├── utils/
│   │   ├── db.ts                   # Prisma client
│   │   ├── logger.ts               # Winston logger
│   │   ├── session.ts              # User session management
│   │   └── keyboards.ts            # Telegram keyboards
│   └── index.ts                    # Main entry point
├── prisma/
│   └── schema.prisma               # Database schema
├── .env.example
├── package.json
└── README.md
```

## 🗄️ Database Schema

### Key Tables

- **users** - Telegram users with bank details
- **wallets** - Generated deposit addresses
- **transactions** - All crypto transactions
- **notifications** - Notification history
- **referrals** - Referral tracking
- **support_tickets** - Support system
- **crypto_rates** - Cached crypto prices
- **audit_logs** - Admin action logs

## 🔐 Security Considerations

### Private Keys
⚠️ **Important**: Private keys are stored in the database. In production:

1. Use environment-based encryption
2. Consider using HSM or vault service
3. Never expose private keys in logs

### API Keys
- Store all API keys in environment variables
- Use different keys for development/production
- Rotate keys periodically

### Admin Access
- Admin is identified by Telegram Chat ID
- Keep `ADMIN_CHAT_ID` secure
- Consider multi-admin support for production

## 🚢 Deployment

### Using PM2

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name cryptobot
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
CMD ["node", "dist/index.js"]
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/cryptobot"
LOG_LEVEL=info
```

## 📊 Monitoring

### Logs
Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

### Health Checks
The deposit checker runs every minute and logs status.

## 🔧 Troubleshooting

### Bot not responding
1. Check if bot token is correct
2. Verify bot is not blocked by user
3. Check logs for errors

### Deposits not detected
1. Verify API keys are valid
2. Check if wallet addresses are correct
3. Verify network selection matches deposit network

### Database errors
1. Run `npm run db:push` to sync schema
2. Check DATABASE_URL is correct
3. Verify database file permissions (SQLite)

## 📝 API Reference

### APIs Used

- **NOWPayments**: Cryptocurrency payments, coin availability, address generation
- **CoinGecko**: Crypto price data
- **BlockCypher** (fallback): Bitcoin transactions
- **Etherscan** (fallback): Ethereum/ERC20 transactions
- **TronGrid** (fallback): Tron/TRC20 transactions

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## 📄 License

MIT License - see LICENSE file

## 🆘 Support

For issues or questions:
1. Open a GitHub issue
2. Contact via Telegram

---

**⚠️ Disclaimer**: This bot handles real cryptocurrency transactions. Ensure you understand the security implications and test thoroughly before deploying to production.
