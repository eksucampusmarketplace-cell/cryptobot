# 🤖 CryptoBot

> **A powerful Telegram bot for cryptocurrency-to-fiat exchange with seamless bank transfer payouts**

CryptoBot enables users to sell cryptocurrency and receive payments directly to their bank accounts. Built with TypeScript and powered by NOWPayments API, it supports 100+ cryptocurrencies with real-time payment detection and a comprehensive admin dashboard.

---

## ✨ Key Features

### 🌐 Multi-Cryptocurrency Support
- **100+ Cryptocurrencies** via NOWPayments API integration
- **Multi-Network Support**: ERC20, TRC20, BEP20, Native chains
- **Popular Coins Priority**: BTC, ETH, USDT, USDC, BNB, XRP, ADA, DOGE, SOL, TRX, DOT, MATIC, LTC, and more displayed first with ⭐ indicator
- **Real-time Rates**: Live cryptocurrency prices with 24h price changes from CoinGecko

### ⚡ Instant Payment Detection
- **IPN Webhooks**: Real-time payment notifications from NOWPayments
- **Polling Fallback**: Background blockchain monitoring as backup
- **Automatic Confirmations**: Tracks blockchain confirmations automatically
- **HMAC-SHA256 Verification**: Cryptographic signature verification for webhooks

### 👤 User Experience
- **Simple Onboarding**: Quick registration with bank details collection
- **Intuitive Flow**: Step-by-step crypto selling process with inline keyboards
- **Transaction History**: Complete history of all past transactions
- **Balance Tracking**: View current balance and statistics
- **Settings Management**: Update bank details anytime

### 💰 Referral System
- **Earn Rewards**: 0.5% bonus from referral's first transaction
- **Unique Referral Links**: Personal referral links for sharing
- **Referral Tracking**: Track referred users and earned bonuses

### 🎫 Support System
- **Built-in Support Tickets**: Create and manage support requests
- **Ticket Thread Management**: Back-and-forth messaging between users and admin
- **Status Tracking**: OPEN, IN_PROGRESS, WAITING_USER, RESOLVED, CLOSED

### 🔐 Admin Dashboard
- **Full Control Panel**: Complete bot management from Telegram
- **Transaction Management**: View, approve, and manage pending payouts
- **User Management**: Search users, view details, ban/unban accounts
- **Broadcast Messages**: Send announcements to all users at once
- **Manual Payout Confirmation**: Mark transactions as paid after bank transfer
- **Real-time Statistics**: Bot metrics and transaction summaries
- **Audit Logging**: Track all admin actions for accountability

### 🛡️ Security & Reliability
- **Rate Limiting**: Prevent spam and abuse with configurable limits
- **Session Management**: Handle multi-step conversations gracefully
- **Error Handling**: Comprehensive error logging and recovery
- **Private Key Encryption**: Secure wallet key storage
- **Admin Authentication**: Secure admin panel access via Telegram Chat ID

---

## 📱 Bot Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/start` | Register or restart the bot |
| `/sell` | Start a new crypto sale |
| `/rates` | View current crypto prices with 24h changes |
| `/balance` | Check your balance and trading stats |
| `/history` | View complete transaction history |
| `/settings` | Update bank details (name, account number, account holder) |
| `/referral` | Get your unique referral link |
| `/support` | Create a support ticket |
| `/help` | Show help message |

### Admin Commands
| Command | Description |
|---------|-------------|
| `/admin` | Open admin control panel |
| `/pending` | View all pending transactions |
| `/users` | View and search all users |
| `/stats` | View bot statistics and metrics |
| `/broadcast` | Send a message to all registered users |

---

## 💱 How It Works

### User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   /start     │────▶│  Register    │────▶│   Verify     │
│   Command    │     │ Bank Details │     │   Account    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Receive    │◀────│   Admin      │◀────│   Deposit    │
│   Payout     │     │   Approves   │     │   Detected   │
└──────────────┘     └──────────────┘     └──────────────┘
```

#### Step-by-Step Process

1. **Registration**
   - User sends `/start` command
   - Bot collects: Bank name, Account number, Account holder name
   - User is verified and ready to trade

2. **Sell Crypto**
   - User selects cryptocurrency from 100+ options
   - User selects network (ERC20, TRC20, BEP20, Native)
   - User enters amount to sell
   - Bot generates unique deposit address via NOWPayments

3. **Deposit Detection**
   - IPN webhook receives instant payment notification
   - Bot tracks blockchain confirmations
   - User and admin receive notifications

4. **Payout**
   - Admin receives pending transaction notification
   - Admin sends bank transfer manually
   - Admin marks transaction as paid in bot
   - User receives payout confirmation

---

## 🏗️ Architecture

### Project Structure

```
cryptobot/
├── src/
│   ├── bot/
│   │   ├── handlers/
│   │   │   ├── userHandler.ts       # Registration & settings
│   │   │   ├── sellHandler.ts       # Crypto selling flow
│   │   │   ├── adminHandler.ts      # Admin commands
│   │   │   ├── supportHandler.ts    # Support tickets
│   │   │   ├── referralHandler.ts   # Referral system
│   │   │   └── callbackHandler.ts   # Inline button callbacks
│   │   └── middleware/
│   │       └── index.ts             # Rate limiting, auth, logging
│   ├── services/
│   │   ├── cryptoService.ts         # Blockchain & price APIs
│   │   ├── nowpaymentsService.ts    # NOWPayments API client
│   │   ├── ipnService.ts            # IPN webhook processing
│   │   ├── webhookService.ts        # HTTP webhook server
│   │   ├── userService.ts           # User management
│   │   ├── transactionService.ts    # Transaction management
│   │   ├── walletService.ts         # Wallet generation
│   │   └── notificationService.ts   # Telegram notifications
│   ├── workers/
│   │   └── depositChecker.ts        # Background monitoring
│   ├── config/
│   │   └── index.ts                 # App configuration
│   ├── utils/
│   │   ├── db.ts                    # Prisma client
│   │   ├── logger.ts                # Winston logger
│   │   ├── session.ts               # User session management
│   │   └── keyboards.ts             # Telegram keyboards
│   └── index.ts                     # Main entry point
├── prisma/
│   └── schema.prisma                # Database schema
├── .env.example
├── package.json
└── README.md
```

### Database Schema

| Table | Description |
|-------|-------------|
| **users** | Telegram users with bank details |
| **wallets** | Generated deposit addresses |
| **transactions** | All crypto transactions with status tracking |
| **notifications** | Notification delivery history |
| **referrals** | Referral tracking and bonuses |
| **support_tickets** | Support ticket management |
| **ticket_messages** | Support ticket conversations |
| **crypto_rates** | Cached cryptocurrency prices |
| **audit_logs** | Admin action audit trail |
| **settings** | Bot configuration storage |

### Payment Detection Flow

```
User Sends Crypto
        │
        ▼
┌─────────────────┐
│  NOWPayments    │
│    Receives     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         IPN Webhook (Primary)       │
│  • Instant notification             │
│  • HMAC-SHA256 signature verified   │
│  • Real-time user update            │
└────────────────┬────────────────────┘
                 │
                 │ (Fallback if IPN fails)
                 ▼
┌─────────────────────────────────────┐
│      Deposit Checker (Polling)      │
│  • Runs every minute                │
│  • Checks pending transactions      │
│  • Updates confirmations            │
└─────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- SQLite (default) or PostgreSQL
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- NOWPayments API Key

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-repo/cryptobot.git
   cd cryptobot
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Required
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ADMIN_CHAT_ID=your_telegram_id_here
   
   # Required - NOWPayments
   NOWPAYMENTS_API_KEY=your_api_key_here
   NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here
   NOWPAYMENTS_IPN_ENABLED=true
   
   # Webhook (for IPN)
   WEBHOOK_URL=https://your-domain.com/webhook/nowpayments
   WEBHOOK_PORT=3001
   
   # Optional - Fallback Blockchain APIs
   BLOCKCYPHER_API_KEY=your_key
   ETHERSCAN_API_KEY=your_key
   TRONGRID_API_KEY=your_key
   ```

3. **Get Telegram Chat ID**
   - Start a chat with [@userinfobot](https://t.me/userinfobot) on Telegram
   - It will reply with your chat ID
   - Add this to `ADMIN_CHAT_ID` in `.env`

4. **Initialize Database**
   ```bash
   npm run db:push
   ```

5. **Start the Bot**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

### Setting Up NOWPayments IPN

1. Sign up at [NOWPayments](https://account.nowpayments.io/)
2. Go to **Settings** → **API Keys** → Generate API Key
3. Go to **Settings** → **IPN**
4. Enable IPN and set URL: `https://your-domain.com/webhook/nowpayments`
5. Generate IPN Secret and add to `.env`

---

## ⚙️ Configuration

### Exchange Settings

```env
EXCHANGE_FEE_PERCENT=1.5      # Fee percentage on transactions
MIN_DEPOSIT_USD=10            # Minimum deposit in USD
MAX_DEPOSIT_USD=10000         # Maximum deposit in USD
```

### Rate Limiting

```env
RATE_LIMIT_MESSAGES=5         # Max messages per window
RATE_LIMIT_WINDOW_MS=60000    # Window in milliseconds (1 minute)
```

### Logging

```env
LOG_LEVEL=info                # debug, info, warn, error
```

### Database

```env
# SQLite (default)
DATABASE_URL="file:./dev.db"

# PostgreSQL (production)
DATABASE_URL="postgresql://user:password@host:5432/cryptobot"
```

---

## 📊 Supported Cryptocurrencies

### Popular Coins (⭐ Displayed First)

| Coin | Symbol | Networks |
|------|--------|----------|
| Bitcoin | BTC | Native, Testnet |
| Ethereum | ETH | ERC20 |
| Tether | USDT | ERC20, TRC20, BEP20 |
| USD Coin | USDC | ERC20, TRC20, BEP20 |
| BNB | BNB | BEP20 |
| XRP | XRP | Native |
| Cardano | ADA | Native |
| Dogecoin | DOGE | Native |
| Solana | SOL | Native |
| Tron | TRX | TRC20 |
| Polkadot | DOT | Native |
| Polygon | MATIC | ERC20 |
| Litecoin | LTC | Native |
| Bitcoin Cash | BCH | Native |
| Chainlink | LINK | ERC20 |
| Uniswap | UNI | ERC20 |
| Cosmos | ATOM | Native |
| Ethereum Classic | ETC | Native |
| Stellar | XLM | Native |
| Algorand | ALGO | Native |

Plus **80+ more cryptocurrencies** available through NOWPayments!

---

## 🚢 Deployment

### Render.com (Recommended - Free Tier Available)

**📖 Full Guide**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for detailed step-by-step instructions.

**Quick Start**:
1. Create a PostgreSQL database on Render (free tier)
2. Connect your GitHub repository
3. Configure environment variables in Render dashboard
4. Deploy!

The included `render.yaml` provides one-click deployment with automatic database migrations.

**Key Environment Variables for Render**:
- `DATABASE_URL` - Your PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `ADMIN_CHAT_ID` - Your Telegram Chat ID
- `NOWPAYMENTS_API_KEY` - Payment processing
- `PAYSTACK_SECRET_KEY` - Bank verification

### PM2 (VPS Deployment)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name cryptobot
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
CMD ["node", "dist/index.js"]
```

```bash
docker build -t cryptobot .
docker run -d -p 3001:3001 --env-file .env cryptobot
```

---

## 📈 Monitoring

### Logs
Logs are stored in `logs/` directory:
- `combined.log` - All application logs
- `error.log` - Error logs only

### Health Checks
- Webhook server provides `/health` endpoint
- Deposit checker logs status every minute
- Winston logger with structured output

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot not responding | Check bot token, verify bot not blocked, check logs |
| Deposits not detected | Verify API keys, check IPN configuration, verify network selection |
| Database errors | Run `npm run db:push`, check DATABASE_URL, verify permissions |
| IPN not working | Ensure webhook URL is publicly accessible, verify IPN secret |
| **Can't reach database server** | See detailed database troubleshooting below |

### Database Connection Issues

If you see `PrismaClientInitializationError: Can't reach database server`:

**On Render:**
1. Verify your PostgreSQL database is in "Available" status
2. Ensure database and web service are in the **same region**
3. Check `DATABASE_URL` is using the **Internal Database URL** (not external)
4. Make sure you're using PostgreSQL, not Supabase connection string
5. See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for detailed setup

**Locally:**
1. Check database is running: `npm run db:studio`
2. Verify DATABASE_URL in `.env` is correct
3. For PostgreSQL: `postgresql://user:password@localhost:5432/cryptobot`
4. For SQLite: `file:./dev.db`

**Common Database URL formats:**
```bash
# Render PostgreSQL (Internal)
postgresql://user:pass@dpg-xxx.region-postgres.render.com/dbname

# Local PostgreSQL
postgresql://user:password@localhost:5432/cryptobot

# SQLite (development only)
file:./dev.db
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🆘 Support

- **GitHub Issues**: [Open an issue](https://github.com/your-repo/cryptobot/issues)
- **Documentation**: See [SETUP.md](SETUP.md) for detailed setup guide
- **Security**: See [SECURITY.md](SECURITY.md) for security policy

---

## ⚠️ Disclaimer

This bot handles real cryptocurrency transactions. Ensure you:
- Understand the security implications
- Test thoroughly in a sandbox environment
- Implement proper security measures
- Have adequate financial controls before production deployment

---

**Built with ❤️ using TypeScript, Telegraf, Prisma, and NOWPayments API**
