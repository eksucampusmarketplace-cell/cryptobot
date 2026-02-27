# Security Guide for CryptoBot

This document outlines security best practices for running CryptoBot with NOWPayments integration.

## API Key Security

### Environment Variables
All API keys are stored in environment variables and loaded via `.env` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your_token
NOWPAYMENTS_API_KEY=your_key

# Optional fallback APIs
BLOCKCYPHER_API_KEY=your_key
ETHERSCAN_API_KEY=your_key
TRONGRID_API_KEY=your_key
```

### Protection Measures
1. **`.gitignore` excludes `.env`** - API keys are never committed to git
2. **Different keys per environment** - Use separate keys for dev/staging/production
3. **Key rotation** - Rotate keys periodically (recommended: every 90 days)
4. **Access logging** - Monitor API key usage in NOWPayments dashboard

## Rate Limiting & Caching

### NOWPayments API Caching
The bot implements caching to prevent API abuse:

- **Cache duration**: 5 minutes (`CACHE_TTL = 5 * 60 * 1000`)
- **Cached data**: Currency configurations, coin lists
- **Benefits**: Reduces API calls, improves response time

### Rate Limits
- NOWPayments: 1000 requests/minute (free tier)
- CoinGecko: 10-30 calls/minute (free tier)
- BlockCypher: 200 requests/hour (free tier)

## Data Protection

### Wallet Security
```env
WALLET_ENCRYPTION_KEY=use-a-long-random-string-min-32-chars
```

- Private keys are stored encrypted in the database
- Use a strong, random encryption key
- Backup encryption keys securely (e.g., password manager)

### Database Security
- SQLite: File permissions should restrict access (`chmod 600`)
- PostgreSQL: Use SSL connections in production
- Regular backups recommended

## Production Checklist

Before deploying to production:

- [ ] Change all default/test API keys
- [ ] Generate strong `WALLET_ENCRYPTION_KEY`
- [ ] Enable HTTPS for webhooks (if used)
- [ ] Set up log rotation
- [ ] Configure database backups
- [ ] Set `NODE_ENV=production`
- [ ] Review and adjust rate limits
- [ ] Enable admin notifications
- [ ] Test fallback behavior (disable NOWPayments temporarily)

## Monitoring & Alerts

### Log Monitoring
Watch for these error patterns:
```
"Error fetching NOWPayments" - API connectivity issues
"No currencies fetched" - Fallback activated
"Invalid API key" - Authentication failure
```

### API Usage Monitoring
- Monitor NOWPayments dashboard for usage spikes
- Set up alerts for failed API calls
- Track cache hit/miss ratios

## Incident Response

### API Key Compromise
1. Immediately revoke the compromised key in NOWPayments dashboard
2. Generate new API key
3. Update environment variables
4. Restart the bot
5. Review logs for unauthorized usage

### Database Breach
1. Rotate `WALLET_ENCRYPTION_KEY`
2. Notify users (if required by law)
3. Restore from clean backup
4. Investigate attack vector

## Webhook Security (Future)

When implementing webhooks:

1. **Signature Verification** - Verify webhook signatures from NOWPayments
2. **IP Whitelisting** - Only accept requests from NOWPayments IPs
3. **HTTPS Only** - Never use HTTP for webhooks
4. **Idempotency** - Handle duplicate webhook deliveries

Example signature verification:
```typescript
const verifyWebhook = (payload: string, signature: string, secret: string): boolean => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
};
```

## Dependency Security

Regularly update dependencies:
```bash
npm audit
npm update
```

Critical dependencies to monitor:
- `axios` - HTTP client
- `telegraf` - Telegram bot framework
- `@prisma/client` - Database ORM
- `ethers` - Ethereum library

## Contact & Support

Security issues should be reported immediately:
1. Check logs in `logs/error.log`
2. Verify API key status with providers
3. Review recent transactions for anomalies
4. Contact NOWPayments support if API issues persist
