# CryptoBot Deployment Checklist

Use this checklist when deploying CryptoBot to ensure everything is configured correctly.

## Pre-Deployment Checklist

### Required Accounts & Services

- [ ] Render.com account (free tier works for testing)
- [ ] Telegram account (for @BotFather and @userinfobot)
- [ ] NOWPayments account (for payment processing)
- [ ] Paystack account (for Nigerian bank verification - optional but recommended)

### Required API Keys & Tokens

- [ ] Telegram Bot Token (from @BotFather)
  - Format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
  - Get from: https://t.me/botfather

- [ ] Telegram Chat ID (from @userinfobot)
  - Format: `123456789` (numeric only)
  - Get from: https://t.me/userinfobot

- [ ] NOWPayments API Key
  - Format: `Y9T-XXXX-XXXX-XXXX-XXXX`
  - Get from: https://account.nowpayments.io/settings/api-keys

- [ ] NOWPayments IPN Secret
  - Format: Random string (generate in NOWPayments dashboard)
  - Get from: https://account.nowpayments.io/settings/ipn

- [ ] Paystack Secret Key (for bank verification)
  - Format: `sk_test_xxxxxxxx` or `sk_live_xxxxxxxx`
  - Get from: https://dashboard.paystack.co/#/settings/developer

### Security Configuration

- [ ] Generate WALLET_ENCRYPTION_KEY
  - Command: `openssl rand -base64 32`
  - ⚠️ Use a different value for each deployment!
  - ⚠️ Never share this key!

## Render Deployment Checklist

### Step 1: Create PostgreSQL Database

- [ ] Log in to Render.com
- [ ] Click New → PostgreSQL
- [ ] Set database name (e.g., `cryptobot-db`)
- [ ] Set database name (e.g., `cryptobot`)
- [ ] Set user (e.g., `cryptobot`)
- [ ] Select region (e.g., Oregon)
- [ ] Select plan (Free for testing)
- [ ] Click Create Database
- [ ] Wait for status to show "Available" (2-5 minutes)

### Step 2: Connect Database URL

- [ ] Open the newly created database
- [ ] Go to Connections section
- [ ] Copy the **Internal Database URL**
  - Format: `postgresql://cryptobot:xxxx@dpg-xxx.region-postgres.render.com/cryptobot`
- [ ] Save this URL for environment variables

### Step 3: Create Web Service

- [ ] Click New → Web Service
- [ ] Connect GitHub repository
- [ ] Select your cryptobot repository
- [ ] Select deployment branch (main/master)
- [ ] Configure settings:
  - [ ] Name: `cryptobot`
  - [ ] Region: Same as database (important!)
  - [ ] Runtime: Node (default)
  - [ ] Build Command: `npm install --include=dev && npm run build`
  - [ ] Start Command: `npm run db:generate && npx prisma db push && node dist/index.js`

### Step 4: Configure Environment Variables

#### Required Variables

- [ ] `DATABASE_URL`
  - Value: Internal database URL from Step 2
  - Example: `postgresql://cryptobot:xxxx@dpg-xxx.oregon-postgres.render.com/cryptobot`

- [ ] `TELEGRAM_BOT_TOKEN`
  - Value: Your bot token from @BotFather
  - Example: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

- [ ] `ADMIN_CHAT_ID`
  - Value: Your numeric Chat ID from @userinfobot
  - Example: `123456789`

#### Payment Processing Variables

- [ ] `NOWPAYMENTS_API_KEY`
  - Value: Your NOWPayments API key
  - Example: `Y9T-XXXX-XXXX-XXXX-XXXX`

- [ ] `NOWPAYMENTS_IPN_SECRET`
  - Value: Your IPN secret from NOWPayments
  - Example: `your_random_secret_string_here`

- [ ] `USE_NOWPAYMENTS`
  - Value: `true`

- [ ] `NOWPAYMENTS_IPN_ENABLED`
  - Value: `true`

#### Webhook URLs

⚠️ **IMPORTANT**: Update these after your service is deployed and you know the URL!

- [ ] `WEBHOOK_URL`
  - Value: `https://cryptobot.onrender.com/webhook/nowpayments`
  - Replace `cryptobot` with your actual service name

- [ ] `WEBAPP_URL`
  - Value: `https://cryptobot.onrender.com/register`
  - Replace `cryptobot` with your actual service name

#### Additional Variables

- [ ] `PAYSTACK_SECRET_KEY`
  - Value: Your Paystack secret key
  - Example: `sk_test_xxxxxxxxxxxxxxxxxx`

- [ ] `WALLET_ENCRYPTION_KEY`
  - Value: Generated with: `openssl rand -base64 32`
  - ⚠️ Use a unique value for each deployment!

#### Optional Variables (have defaults in render.yaml)

- [ ] `SUPPORTED_CRYPTOS` (default: `BTC,ETH,USDT,USDC`)
- [ ] `EXCHANGE_FEE_PERCENT` (default: `1.5`)
- [ ] `MIN_DEPOSIT_USD` (default: `10`)
- [ ] `MAX_DEPOSIT_USD` (default: `10000`)
- [ ] `RATE_LIMIT_MESSAGES` (default: `5`)
- [ ] `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- [ ] `ADMIN_NOTIFICATIONS` (default: `true`)
- [ ] `USER_NOTIFICATIONS` (default: `true`)

### Step 5: Deploy

- [ ] Click "Create Web Service"
- [ ] Watch the deployment in the Logs tab
- [ ] Wait for deployment to complete (3-5 minutes)

## Post-Deployment Checklist

### Verification

- [ ] Check logs show "Database connected"
- [ ] Check logs show "Bot started successfully"
- [ ] Check logs show "Webhook server listening"
- [ ] Open Telegram and send `/start` to your bot
- [ ] Receive welcome message from bot
- [ ] Test `/rates` command
- [ ] Test `/help` command

### NOWPayments Configuration

- [ ] Get your deployed service URL (e.g., `https://cryptobot.onrender.com`)
- [ ] Go to NOWPayments dashboard → Settings → IPN
- [ ] Enable IPN
- [ ] Set IPN URL: `https://cryptobot.onrender.com/webhook/nowpayments`
- [ ] Generate IPN Secret
- [ ] Update `NOWPAYMENTS_IPN_SECRET` in Render environment variables
- [ ] Redeploy the service

### Testing

- [ ] Test user registration flow
- [ ] Test selling crypto flow
- [ ] Test bank account verification
- [ ] Test admin commands (use `/admin`)
- [ ] Test support ticket creation
- [ ] Test referral link generation

### Admin Setup

- [ ] Send `/admin` command as admin
- [ ] Verify admin keyboard appears
- [ ] Test `/pending` command
- [ ] Test `/stats` command
- [ ] Test `/users` command
- [ ] Test `/broadcast` command (with test message)

## Monitoring & Maintenance

### Initial Monitoring

- [ ] Check logs for any errors in first 24 hours
- [ ] Monitor database connection stability
- [ ] Verify webhook endpoints are working
- [ ] Check memory usage (stay within limits)

### Ongoing Maintenance

- [ ] Review logs weekly for issues
- [ ] Monitor database storage usage
- [ ] Keep dependencies updated
- [ ] Test payment flow monthly
- [ ] Backup database regularly

### Security Checklist

- [ ] Never share `WALLET_ENCRYPTION_KEY`
- [ ] Never share API keys
- [ ] Rotate secrets periodically
- [ ] Monitor for suspicious activity
- [ ] Keep Telegram bot token secure
- [ ] Use strong database passwords
- [ ] Enable SSL/TLS (automatic on Render)

## Troubleshooting Quick Reference

### Bot Not Responding

1. Check deployment status in Render
2. Check logs for errors
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Ensure bot is not blocked in Telegram

### Database Connection Errors

1. Verify database status is "Available"
2. Check `DATABASE_URL` is correct
3. Ensure same region for database and service
4. Verify using Internal Database URL

### Payments Not Detected

1. Verify `NOWPAYMENTS_API_KEY` is correct
2. Check `WEBHOOK_URL` is publicly accessible
3. Verify `NOWPAYMENTS_IPN_SECRET` matches
4. Check IPN is enabled in NOWPayments

### Build Fails

1. Check for TypeScript errors locally
2. Verify all dependencies in package.json
3. Clear build cache and redeploy
4. Check Node.js version compatibility

## Quick Commands

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio
npm run db:studio
```

### Local Testing with Remote Database

```bash
# Set DATABASE_URL to external connection
export DATABASE_URL="postgresql://..."

# Run Prisma Studio
npx prisma studio
```

### Useful URLs

- **Bot Health**: `https://your-service.onrender.com/health`
- **Registration Page**: `https://your-service.onrender.com/register`
- **API Banks**: `https://your-service.onrender.com/api/banks`
- **API Resolve Account**: `https://your-service.onrender.com/api/resolve-account`

## Documentation Links

- [Full Deployment Guide](RENDER_DEPLOYMENT.md) - Detailed Render deployment instructions
- [Setup Guide](SETUP.md) - General setup and configuration
- [Main README](README.md) - Project overview and features
- [Deployment Fix](DEPLOYMENT_FIX.md) - Database connection fix details
- [NOWPayments Integration](NOWPAYMENTS_INTEGRATION.md) - Payment processor setup
- [Security Guide](SECURITY.md) - Security best practices

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Telegraf Docs**: https://telegraf.js.org
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **NOWPayments Docs**: https://documenter.getpostman.com/view/9406268/S1a3Rkcd

---

## ✅ Deployment Complete Checklist

When all items above are checked, your deployment is complete and ready for use!

- [ ] All environment variables configured
- [ ] Database connected and schema created
- [ ] Bot responding to commands
- [ ] Webhooks configured and working
- [ ] Admin panel accessible
- [ ] Payment processing tested
- [ ] Monitoring set up
- [ ] Security measures in place

---

**Last Updated**: 2024-02-27
**Version**: 1.0
