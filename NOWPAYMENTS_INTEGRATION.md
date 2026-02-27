# NOWPayments Integration

This document describes the NOWPayments API integration for CryptoBot.

## Overview

The CryptoBot uses NOWPayments API to support 100+ cryptocurrencies with:
- **IPN (Instant Payment Notifications)** - Real-time payment updates via webhooks (recommended)
- **Polling Fallback** - Traditional blockchain monitoring as backup
- **Popular Coins First** - Priority display for major cryptocurrencies

## Features

### 1. Dual Payment Detection System

#### IPN (Primary) - Instant Payment Notifications
- **Real-time updates** - Receive payment status instantly via webhooks
- **Signature verification** - Cryptographic verification of notifications
- **Lower API usage** - Reduces NOWPayments API calls
- **Faster user experience** - Users get instant confirmation

#### Polling (Fallback) - Blockchain Monitoring
- **Backup detection** - Catches payments if IPN fails
- **Non-NOWPayments coins** - Supports coins not using NOWPayments
- **Verification** - Double-checks IPN notifications

### 2. All Coins Support
- Supports all cryptocurrencies available on NOWPayments (100+)
- Automatic coin availability updates via API
- Multi-network support (ERC20, TRC20, BEP20, Native)

### 3. Popular Coins First
Popular coins are displayed with a ⭐ icon and appear first in the list:
- BTC (Bitcoin)
- ETH (Ethereum)
- USDT (Tether)
- USDC (USD Coin)
- BNB (BNB)
- XRP (XRP)
- ADA (Cardano)
- DOGE (Dogecoin)
- SOL (Solana)
- TRX (Tron)
- DOT (Polkadot)
- MATIC (Polygon)
- LTC (Litecoin)
- BCH (Bitcoin Cash)
- LINK (Chainlink)
- UNI (Uniswap)
- ATOM (Cosmos)
- ETC (Ethereum Classic)
- XLM (Stellar)
- ALGO (Algorand)

### 4. Dynamic Configuration
- Coin configurations are fetched from NOWPayments API
- Configurations are cached for 5 minutes to reduce API calls
- Fallback to static config if API is unavailable

## Configuration

### Environment Variables

```env
# Required for NOWPayments integration
NOWPAYMENTS_API_KEY=your_api_key_here
USE_NOWPAYMENTS=true

# IPN (Webhook) Configuration - Highly Recommended
NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here
NOWPAYMENTS_IPN_ENABLED=true
WEBHOOK_URL=https://your-domain.com/webhook/nowpayments
WEBHOOK_PORT=3001

# Optional - disable NOWPayments and use static config only
USE_NOWPAYMENTS=false
SUPPORTED_CRYPTOS=BTC,ETH,USDT,USDC
```

### IPN (Webhook) Setup

IPN provides **instant payment notifications** and is the recommended way to receive payment updates.

#### Step 1: Configure Environment
```env
NOWPAYMENTS_IPN_SECRET=your_secret_from_dashboard
NOWPAYMENTS_IPN_ENABLED=true
WEBHOOK_PORT=3001
```

#### Step 2: Expose Webhook Endpoint
Your server must be publicly accessible. Options:
- **Production**: Use a VPS with public IP/domain
- **Development**: Use ngrok for local testing
  ```bash
  ngrok http 3001
  # Use the https URL as WEBHOOK_URL
  ```

#### Step 3: Configure in NOWPayments Dashboard
1. Log in to https://account.nowpayments.io/
2. Go to **Settings** → **IPN**
3. Enable IPN
4. Set URL to: `https://your-domain.com/webhook/nowpayments`
5. Generate and save the IPN Secret
6. Copy the secret to your `.env` file

#### Step 4: Restart Bot
```bash
npm run dev
```

You'll see in logs:
```
Webhook server listening on port 3001
IPN endpoint: http://localhost:3001/webhook/nowpayments
IPN webhooks enabled - listening for NOWPayments notifications
```

### Getting API Key

1. Sign up at https://account.nowpayments.io/
2. Verify your email
3. Go to Settings → API Keys
4. Generate a new API key

## Architecture

### Payment Detection Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Sends    │────▶│  NOWPayments    │────▶│  IPN Webhook    │
│     Crypto      │     │   Receives      │     │   Notification  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Gets     │◀────│   Transaction   │◀────│   Bot Updates   │
│   Confirmation  │     │    Updated      │     │    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              │ (Fallback)
                              ▼
                       ┌─────────────────┐
                       │ Deposit Checker │
                       │   (Polling)     │
                       └─────────────────┘
```

### New Files

1. **`src/services/nowpaymentsService.ts`**
   - Main NOWPayments API client
   - Fetches available currencies
   - Processes and sorts currencies (popular first)
   - Creates payments and checks status
   - Caches configurations

2. **`src/services/ipnService.ts`**
   - Processes NOWPayments IPN notifications
   - Verifies HMAC-SHA256 signatures
   - Maps IPN statuses to transaction statuses
   - Sends notifications to users and admins

3. **`src/services/webhookService.ts`**
   - HTTP server for receiving webhooks
   - Handles `/webhook/nowpayments` endpoint
   - Health check endpoint at `/health`
   - Compatible with Express or native Node.js HTTP

### Modified Files

1. **`src/config/index.ts`**
   - Added NOWPayments API key config
   - Added `useNowPayments` flag
   - Extended CRYPTO_CONFIG with priority and isPopular fields

2. **`src/utils/keyboards.ts`**
   - `getCryptoSelectionKeyboard()` now async
   - Fetches coins from NOWPayments API
   - Displays ⭐ for popular coins
   - Two-column layout for better mobile UX

3. **`src/bot/handlers/sellHandler.ts`**
   - Uses dynamic crypto config for min amounts
   - Uses dynamic confirmations from NOWPayments
   - Shows popular coin indicator in UI

4. **`src/services/cryptoService.ts`**
   - Extended CoinGecko ID mapping for 25+ coins
   - `getAllRates()` fetches rates for NOWPayments coins
   - Supports dynamic coin ID resolution

5. **`src/services/transactionService.ts`**
   - Added `requiredConfirmations` to CreateTransactionData
   - Configurable per-coin confirmations

## API Endpoints Used

### NOWPayments API v1

1. **GET /currencies**
   - Lists all available currencies
   - Used for coin availability

2. **GET /merchant/coins**
   - Lists coins available for payments
   - Includes network and priority info

3. **POST /payment**
   - Creates a new payment
   - Returns payment address

4. **GET /payment/{id}**
   - Gets payment status
   - Tracks deposit confirmations

5. **GET /min-amount**
   - Gets minimum payment amount
   - Per-coin minimums

6. **GET /estimate**
   - Gets estimated exchange amount
   - Price estimation

## Coin Display Order

Coins are sorted by:
1. **Popular status** - Popular coins appear first
2. **Priority** - Within popular/non-popular groups, by priority

This ensures users see the most commonly used coins at the top.

## Fallback Behavior

If NOWPayments API is unavailable:
1. Bot uses static CRYPTO_CONFIG
2. Falls back to 6 basic coins (BTC, ETH, USDT, USDC, BNB, TRX)
3. Blockchain APIs (BlockCypher, Etherscan, TronGrid) for monitoring

## Testing

### Manual Test Checklist

1. Start bot with NOWPayments API key
2. Send `/sell` command
3. Verify ⭐ appears next to popular coins
4. Verify popular coins appear first in list
5. Select a coin and verify networks load correctly
6. Complete a test transaction
7. Verify confirmations match coin requirements

### API Key Validation

To verify your NOWPayments API key:
```bash
curl -H "x-api-key: YOUR_API_KEY" https://api.nowpayments.io/v1/status
```

## Troubleshooting

### "No coins showing"
- Check NOWPayments API key is valid
- Verify `USE_NOWPAYMENTS=true` in .env
- Check logs for API errors

### "Popular coins not first"
- Verify API key has access to merchant endpoints
- Check if currencies are being cached (5 min cache)
- Restart bot to clear cache

### "Min amount incorrect"
- Bot uses fallback amounts if NOWPayments unavailable
- Check API connectivity
- Verify coin code matches NOWPayments codes

## Security Considerations

### IPN Security

The IPN implementation includes several security measures:

1. **HMAC-SHA256 Signature Verification**
   - Each IPN notification includes a signature
   - Signature is verified using your IPN Secret
   - Prevents spoofed/fake notifications

2. **Timing-Safe Comparison**
   - Uses `crypto.timingSafeEqual()` to prevent timing attacks
   - Signature comparison is constant-time

3. **Idempotency**
   - Duplicate IPN notifications are handled gracefully
   - Transaction status updates are idempotent

### API Key Storage

1. **Environment Variables**
   - Store NOWPayments API key and IPN secret in `.env`
   - Never commit API keys to git (`.gitignore` includes `.env`)
   - Use different keys for dev/production

2. **IPN Secret Protection**
   - The IPN secret is used to verify webhook authenticity
   - Keep it secure and rotate periodically
   - If compromised, generate a new one in dashboard

### Rate Limiting

1. **Configuration Caching**
   - Currency configs cached for 5 minutes
   - Reduces NOWPayments API calls

2. **Webhook Processing**
   - Returns 200 OK even on processing errors
   - Prevents NOWPayments from retrying unnecessarily
   - Logs errors for investigation

### Webhook Security Checklist

- [ ] Use HTTPS for webhook URL (required for production)
- [ ] Verify IPN signatures are enabled
- [ ] Implement webhook authentication
- [ ] Monitor for unexpected webhook patterns
- [ ] Log all webhook receipts for audit trail

## Migration from v1 (without NOWPayments)

Existing bots without NOWPayments will continue to work:

1. Set `USE_NOWPAYMENTS=false` to use old behavior
2. Or add NOWPayments API key to enable new features
3. Database schema is compatible - no migration needed

## Future Enhancements

Possible improvements:
1. Webhook support for instant payment notifications
2. Fiat currency support via NOWPayments
3. Recurring payments
4. Coin swap functionality
5. Multi-coin estimates in one call
