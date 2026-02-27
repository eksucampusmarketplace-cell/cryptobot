# Setup Guide - CryptoBot

This guide walks you through setting up the CryptoBot from scratch.

## Step 1: Create Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot`
3. Follow the prompts:
   - Enter bot name (e.g., "My Crypto Exchange")
   - Enter bot username (must end in `bot`, e.g., `mycrypto_exchange_bot`)
4. BotFather will give you a **Bot Token** - save this!

```
Example token: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

## Step 2: Get Your Telegram Chat ID

1. Search for @userinfobot on Telegram
2. Start it and it will reply with your Chat ID
3. Save this - you'll need it for admin access

```
Example: 123456789
```

## Step 3: Get NOWPayments API Key (Required for 100+ coin support)

1. Go to https://account.nowpayments.io/
2. Sign up for a free account
3. Complete email verification
4. Go to "Settings" → "API Keys"
5. Generate a new API key
6. Copy the key (starts with `Y9T-` or similar)

```
Example: Y9T-XXXX-XXXX-XXXX-XXXX
```

**Why NOWPayments?**
- Supports 100+ cryptocurrencies
- Automatic coin availability updates
- Popular coins appear first in the UI
- No KYC required for basic usage

## Step 4: Get Blockchain API Keys (Optional)

These are used as fallbacks or for manual transaction tracking:

### BlockCypher (for Bitcoin)
1. Go to https://accounts.blockcypher.com/
2. Sign up for a free account
3. Go to API Tokens and copy your token
4. Free tier: 200 requests/hour

### Etherscan (for Ethereum/ERC20)
1. Go to https://etherscan.io/register
2. Create an account
3. Go to API Keys section
4. Create a new API key
5. Free tier: 5 requests/second

### TronGrid (for Tron/TRC20)
1. Go to https://www.trongrid.io/
2. Sign up and get your API key
3. Free tier available

## Step 5: Configure Environment

Create `.env` file in the project root:

```env
# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_CHAT_ID=123456789

# NOWPayments (Required for 100+ coin support)
NOWPAYMENTS_API_KEY=Y9T-XXXX-XXXX-XXXX-XXXX
USE_NOWPAYMENTS=true

# IPN Webhooks (Recommended for instant notifications)
# Get secret from: NOWPayments Dashboard → Settings → IPN
NOWPAYMENTS_IPN_SECRET=ipn_secret_from_dashboard
NOWPAYMENTS_IPN_ENABLED=true
WEBHOOK_PORT=3001

# Supported Cryptos (used as fallback if NOWPayments is disabled)
SUPPORTED_CRYPTOS=BTC,ETH,USDT,USDC

# Blockchain API Keys (Optional - used as fallback)
BLOCKCYPHER_API_KEY=your_blockcypher_key
ETHERSCAN_API_KEY=your_etherscan_key
TRONGRID_API_KEY=your_trongrid_key

# Wallet Encryption (generate a secure key)
WALLET_ENCRYPTION_KEY=use-a-long-random-string-here

# Exchange Settings
EXCHANGE_FEE_PERCENT=1.5
MIN_DEPOSIT_USD=10
MAX_DEPOSIT_USD=10000

# Database (SQLite for development)
DATABASE_URL="file:./dev.db"
```

## Step 6: Install Dependencies

```bash
npm install
```

## Step 7: Initialize Database

```bash
npm run db:push
```

This creates the SQLite database with all tables.

## Step 8: Start the Bot

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Step 9: Test the Bot

1. Open Telegram
2. Search for your bot by username
3. Send `/start`
4. Complete registration with bank details
5. Test the `/sell` flow
6. You should see ⭐ popular coins listed first

## Step 10: Configure IPN Webhooks (Recommended)

For instant payment notifications:

1. Make your server publicly accessible (use ngrok for local testing):
   ```bash
   ngrok http 3001
   ```

2. In NOWPayments dashboard:
   - Go to Settings → IPN
   - Enable IPN
   - Set URL: `https://your-ngrok-url.ngrok.io/webhook/nowpayments`
   - Generate and save IPN Secret

3. Update your `.env` with the IPN secret

4. Restart the bot

You'll see webhook confirmation in logs:
```
Webhook server listening on port 3001
IPN webhooks enabled - listening for NOWPayments notifications
```

## Step 11: Admin Access

As the admin (your Chat ID is in ADMIN_CHAT_ID):

1. Send `/admin` to access admin panel
2. View pending transactions with `/pending`
3. View statistics with `/stats`
4. Manage users with `/users`

## Running Deposit Checker

The deposit checker runs automatically when the bot starts.

To run it separately (optional):
```bash
npm run deposit-checker
```

## Production Deployment

### Option 1: VPS with PM2

```bash
# Install PM2
npm install -g pm2

# Build the project
npm run build

# Start with PM2
pm2 start dist/index.js --name cryptobot

# Enable auto-start on reboot
pm2 startup
pm2 save
```

### Option 2: Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
RUN npx prisma generate
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t cryptobot .
docker run -d --name cryptobot \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e ADMIN_CHAT_ID=your_id \
  -e DATABASE_URL="file:./data/dev.db" \
  -v cryptobot-data:/app/prisma \
  cryptobot
```

### Option 3: Railway/Render/Heroku

1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

## Monitoring

View logs:
```bash
# If using PM2
pm2 logs cryptobot

# Direct logs
tail -f logs/combined.log
```

## Database Management

Open Prisma Studio (GUI for database):
```bash
npm run db:studio
```

## Troubleshooting

### Bot not responding
```bash
# Check if bot is running
pm2 status

# Check logs
pm2 logs cryptobot

# Restart bot
pm2 restart cryptobot
```

### Database locked errors
```bash
# Stop bot
pm2 stop cryptobot

# Check database
npm run db:studio

# Restart
pm2 start cryptobot
```

### API rate limits
- BlockCypher: 200 req/hour (free)
- Etherscan: 5 req/sec (free)
- Consider upgrading plans for production

## Security Checklist

- [ ] Change `WALLET_ENCRYPTION_KEY` to a secure random string
- [ ] Never commit `.env` file
- [ ] Use PostgreSQL for production
- [ ] Enable HTTPS for webhook mode
- [ ] Regular database backups
- [ ] Monitor bot activity

## Backup & Recovery

Backup SQLite database:
```bash
cp prisma/dev.db backups/dev_$(date +%Y%m%d).db
```

For PostgreSQL:
```bash
pg_dump cryptobot > backup_$(date +%Y%m%d).sql
```

## Support

For issues:
1. Check logs in `logs/` directory
2. Verify API keys are valid
3. Test with minimal configuration first
