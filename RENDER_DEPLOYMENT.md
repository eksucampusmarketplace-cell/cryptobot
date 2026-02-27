# Render Deployment Guide - CryptoBot

This guide provides step-by-step instructions for deploying CryptoBot to Render.com with a fully configured PostgreSQL database.

## Prerequisites

Before deploying to Render, make sure you have:
- A Render.com account (free tier available)
- A Telegram bot token (from @BotFather)
- Your Telegram Chat ID (from @userinfobot)
- A NOWPayments API key and IPN secret (recommended)

---

## Step 1: Set Up PostgreSQL Database on Render

### 1.1 Create a New PostgreSQL Database

1. Log in to [Render.com](https://dashboard.render.com)
2. Click **New** → **PostgreSQL**
3. Configure the database:
   - **Name**: `cryptobot-db` (or any name you prefer)
   - **Database**: `cryptobot`
   - **User**: `cryptobot` (or leave default)
   - **Region**: Choose the region closest to your users
   - **Plan**: Free tier is sufficient for development/testing
4. Click **Create Database**

### 1.2 Wait for Database to be Ready

The database will take a few minutes to initialize. Wait until you see the status change to **Available**.

### 1.3 Get the Database Connection URL

1. Click on your newly created database
2. Scroll down to the **Connections** section
3. Copy the **Internal Database URL** (it should look like):
   ```
   postgresql://cryptobot:randompassword@dpg-xxxx.oregon-postgres.render.com/cryptobot
   ```

**Important**: Save this URL - you'll need it for the environment variables.

### 1.4 Test the Database Connection (Optional)

You can test the connection using the **Connect** button in Render:
1. Click the **Connect** button
2. Select **External Connection**
3. Copy the connection string and test it locally if needed

---

## Step 2: Connect Your Repository to Render

### 2.1 Link GitHub Repository

1. In Render dashboard, click **New** → **Web Service**
2. Click **Connect GitHub** (you may need to authorize Render)
3. Select your `cryptobot` repository
4. Select the branch you want to deploy (usually `main` or `master`)

### 2.2 Configure Basic Settings

- **Name**: `cryptobot`
- **Region**: Same region as your PostgreSQL database
- **Branch**: Your deployment branch
- **Runtime**: Node (default)
- **Build Command**: `npm install --include=dev && npm run db:generate && npm run build`
- **Start Command**: `node dist/index.js`

---

## Step 3: Configure Environment Variables

The `render.yaml` file in your repository is already configured with all the necessary environment variables. You just need to provide the values in the Render dashboard.

### 3.1 Add Environment Variables

In the **Environment** section of your web service, add the following variables:

#### Required Variables

| Key | Value | Description |
|-----|-------|-------------|
| `DATABASE_URL` | Your PostgreSQL connection URL from Step 1.3 | Database connection |
| `TELEGRAM_BOT_TOKEN` | Your bot token from @BotFather | Telegram API access |
| `ADMIN_CHAT_ID` | Your Telegram Chat ID from @userinfobot | Admin access |

#### NOWPayments Variables (Recommended)

| Key | Value | Description |
|-----|-------|-------------|
| `NOWPAYMENTS_API_KEY` | Your NOWPayments API key | Payment processing |
| `NOWPAYMENTS_IPN_SECRET` | Your IPN secret from NOWPayments dashboard | Webhook verification |
| `USE_NOWPAYMENTS` | `true` | Enable NOWPayments |

#### Webhook URLs

| Key | Value | Description |
|-----|-------|-------------|
| `WEBHOOK_URL` | `https://your-service-name.onrender.com/webhook/nowpayments` | NOWPayments webhook endpoint |
| `WEBAPP_URL` | `https://your-service-name.onrender.com/register` | Registration page URL |

**Note**: Replace `your-service-name` with your actual Render service name (e.g., `cryptobot`).

#### Paystack Variables (Required for Nigerian Bank Payouts)

| Key | Value | Description |
|-----|-------|-------------|
| `PAYSTACK_SECRET_KEY` | Your Paystack secret key | Bank account verification |

Get your key from: https://dashboard.paystack.co/#/settings/developer

#### Security Variables

| Key | Value | Description |
|-----|-------|-------------|
| `WALLET_ENCRYPTION_KEY` | Generate a long random string | Encrypts wallet private keys |

**Important**: Use a strong, unique value for this! You can generate one with:
```bash
openssl rand -base64 32
```

#### Optional Variables

These are already set with sensible defaults in `render.yaml`:

- `EXCHANGE_FEE_PERCENT`: `1.5`
- `MIN_DEPOSIT_USD`: `10`
- `MAX_DEPOSIT_USD`: `10000`
- `RATE_LIMIT_MESSAGES`: `5`
- `RATE_LIMIT_WINDOW_MS`: `60000`
- `ADMIN_NOTIFICATIONS`: `true`
- `USER_NOTIFICATIONS`: `true`

### 3.2 Configure Database URL

Use the **Internal Database URL** you copied in Step 1.3. It should look like:

```
postgresql://cryptobot:xxxxxx@dpg-xxxx.oregon-postgres.render.com:5432/cryptobot
```

**Important**: Always use the **Internal Database URL** for better performance and security. The external URL is only for connecting from outside Render.

---

## Step 4: Deploy the Application

### 4.1 Start the Deployment

1. Click **Create Web Service**
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Generate Prisma client
   - Build the TypeScript code
   - Start the bot

### 4.2 Monitor the Deployment

- Watch the **Logs** tab to see the deployment progress
- You should see messages like:
  ```
  Database connected
  Bot started successfully
  Webhook server listening on port 10000
  ```

### 4.3 Troubleshoot Common Issues

#### Issue: "Failed to start bot: Can't reach database server"

**Solution**: Check your `DATABASE_URL`:
- Make sure you're using the **Internal Database URL**
- Verify the database status is "Available"
- Ensure the database is in the same region as your web service

#### Issue: "TELEGRAM_BOT_TOKEN is required"

**Solution**: Make sure you've added the `TELEGRAM_BOT_TOKEN` environment variable and it starts with the correct format (e.g., `1234567890:ABCdefGHI...`)

#### Issue: Build fails with "Module not found"

**Solution**: Make sure all dependencies are in `package.json` and try redeploying

---

## Step 5: Configure NOWPayments Webhooks

### 5.1 Get Your Webhook URL

After deployment, your bot will have a public URL like:
```
https://cryptobot.onrender.com
```

Your webhook URL should be:
```
https://cryptobot.onrender.com/webhook/nowpayments
```

### 5.2 Configure NOWPayments IPN

1. Log in to [NOWPayments](https://account.nowpayments.io/)
2. Go to **Settings** → **IPN**
3. Enable IPN
4. Set the IPN URL to your Render webhook URL
5. Generate an IPN Secret
6. Add the secret to your Render environment variable `NOWPAYMENTS_IPN_SECRET`
7. **Important**: Redeploy your service after adding the IPN secret

### 5.3 Update Environment Variables in Render

1. Go to your web service in Render
2. Click **Environment** tab
3. Add or update:
   - `WEBHOOK_URL`: `https://your-service-name.onrender.com/webhook/nowpayments`
   - `NOWPAYMENTS_IPN_SECRET`: Your generated secret
4. Click **Save Changes**
5. Render will automatically redeploy

---

## Step 6: Verify Deployment

### 6.1 Check Bot Status

1. Go to the **Logs** tab in Render
2. Look for these messages:
   ```
   Database connected
   Bot started successfully
   IPN webhooks enabled - listening for NOWPayments notifications
   Webhook server listening on port 10000
   ```

### 6.2 Test the Bot

1. Open Telegram
2. Search for your bot by username
3. Send `/start`
4. You should receive a welcome message

### 6.3 Test Health Endpoint

You can check if the webhook server is running:
```bash
curl https://your-service-name.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "ipn": true,
  "timestamp": "2024-02-27T12:00:00.000Z"
}
```

### 6.4 Test Registration Page

Visit: `https://your-service-name.onrender.com/register`

You should see the registration form.

---

## Step 7: Post-Deployment Setup

### 7.1 Set Admin Permissions

Your Chat ID (from `ADMIN_CHAT_ID`) already has admin access. Test it:

1. Send `/admin` to your bot
2. You should see the admin keyboard

### 7.2 Configure Automatic Database Backups

Render PostgreSQL databases have automatic backups, but you can also:

1. Go to your database in Render
2. Click **Backups** tab
3. Configure backup retention period

### 7.3 Monitor Logs

Regularly check the logs for errors:
- Go to your web service
- Click the **Logs** tab
- Filter by level: `INFO`, `WARN`, `ERROR`

### 7.4 Set Up Monitoring

Consider setting up:
- **Uptime monitoring**: Use a service like UptimeRobot to monitor your health endpoint
- **Error tracking**: Consider using a service like Sentry for error tracking

---

## Step 8: Maintenance

### 8.1 Redeploy After Code Changes

When you push code changes to your repository:
- Render automatically detects the commit
- Triggers a new build and deployment
- Database migrations run automatically (if needed)

### 8.2 Manual Redeploy

To force a redeploy without code changes:
1. Go to your web service
2. Click **Manual Deploy** → **Clear build cache & deploy**

### 8.3 View Logs

- **Real-time logs**: Click the **Logs** tab
- **Past logs**: Click the **Events** tab

### 8.4 Database Management

You can manage your database using Prisma Studio:

**From local machine**:
```bash
# Set DATABASE_URL to your external connection string
export DATABASE_URL="postgresql://..."

# Open Prisma Studio
npx prisma studio
```

Or use the **Connect** button in Render's database dashboard to use psql or other database tools.

---

## Common Issues and Solutions

### Issue: Port Scan Timeout - No Open Ports Detected

**Symptoms**:
```
==> No open ports detected, continuing to scan...
==> Port scan timeout reached, no open ports detected.
```

**Root Cause**: The server is not starting before Render's port scan timeout. Common causes:
1. `prisma db push` in start command blocking startup
2. Database connection retry blocking the server
3. Application crash during initialization

**Solution**: Ensure the HTTP server starts immediately:

1. The `startCommand` should NOT include database operations like `prisma db push`
2. Use the correct start command:
   ```
   node dist/index.js
   ```
3. Database operations should happen asynchronously after the server starts

**What we do**: The bot starts its HTTP server first, then connects to the database in the background. This ensures Render can detect the open port even if the database is slow or unavailable.

### Issue: Database Connection Timeout

**Symptoms**: "Can't reach database server" error

**Solutions**:
1. Check database status is "Available"
2. Ensure database and web service are in the same region
3. Verify `DATABASE_URL` is correct
4. Check if database has reached connection limits

### Issue: Supabase Database Authentication Failed

**Symptoms**:
```
Authentication failed against database server at `aws-1-eu-central-1.pooler.supabase.com`
The provided database credentials for `postgres` are not valid.
```

**Root Cause**: The DATABASE_URL has incorrect credentials (wrong username or password).

**Solution**: Verify and fix the DATABASE_URL:

1. Go to Supabase Dashboard → Project Settings → Database
2. Find **Connection Pooling** section
3. Copy the connection string (make sure to include the full password)
4. The username should include the project reference, e.g., `postgres.xyzabc123`
5. Update `DATABASE_URL` in Render environment variables

**Correct format**:
```
postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Important**:
- The password may contain special characters that need URL encoding
- If you reset your database password, you need to update the connection string
- The project reference is part of the username (e.g., `postgres.abcdefghijk`)

### Issue: Supabase Database Connection Failed (P1001 Error)

**Symptoms**: 
```
Can't reach database server at `db.xxxxx.supabase.co:5432`
```

**Root Cause**: Supabase direct connections (port 5432) often fail from container environments like Render due to:
- IPv4 not available on free tier
- Database paused due to inactivity
- Connection limits exceeded

**Solution**: Use Supabase's **Connection Pooler** instead:

1. Go to Supabase Dashboard → Project Settings → Database
2. Find **Connection Pooling** section
3. Copy the **Transaction mode** connection string (port 6543)
4. Update `DATABASE_URL` in Render:
   ```
   postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

**Important**: 
- Use port **6543** (pooler), NOT 5432 (direct)
- The pooler hostname contains `pooler.supabase.com`
- For Prisma migrations, you may also need to set `DIRECT_DATABASE_URL` to the direct connection string

**Alternative Solutions**:
1. Enable IPv4 in Supabase (paid feature): Project Settings → Database → IPv4
2. Wake up paused database by logging into Supabase dashboard
3. Upgrade Supabase plan to remove connection limits

### Issue: Bot Not Responding

**Symptoms**: Bot doesn't reply to commands

**Solutions**:
1. Check logs for errors
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Ensure bot is running (check deployment status)
4. Try sending `/start` to the bot again

### Issue: IPN Webhooks Not Working

**Symptoms**: Payments not detected

**Solutions**:
1. Verify `WEBHOOK_URL` is publicly accessible
2. Check `NOWPAYMENTS_IPN_SECRET` matches
3. Test with a small payment
4. Check logs for webhook errors

### Issue: High Memory Usage

**Symptoms**: Service keeps restarting

**Solutions**:
1. Upgrade to a paid plan with more RAM
2. Check for memory leaks in logs
3. Reduce `RATE_LIMIT_WINDOW_MS` to process fewer concurrent requests

---

## Cost Estimation

### Free Tier (Development/Testing)

- **Web Service**: Free (limited hours)
- **PostgreSQL Database**: Free (256MB RAM, 1GB storage)
- **Total**: $0/month

**Limitations**:
- Web service spins down after 15 minutes of inactivity
- Takes ~30 seconds to wake up
- Limited database performance

### Paid Tier (Production)

- **Web Service Starter**: $7/month (0.5 CPU, 512MB RAM)
- **PostgreSQL Starter**: $7/month (1GB RAM, 10GB storage)
- **Total**: ~$14/month

**Benefits**:
- Always running
- Better performance
- More storage
- No cold starts

---

## Security Checklist

Before going to production:

- [ ] Change `WALLET_ENCRYPTION_KEY` to a secure random value
- [ ] Use strong passwords for database user
- [ ] Enable HTTPS (automatic on Render)
- [ ] Set up regular database backups
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for all secrets
- [ ] Never commit `.env` file
- [ ] Restrict admin access to trusted Chat IDs

---

## Next Steps

1. Test the bot thoroughly with small transactions
2. Set up monitoring and alerting
3. Configure automatic backups
4. Document your deployment process
5. Set up a staging environment for testing changes

---

## Support

For issues specific to Render:
- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com)

For issues with the bot:
- Check the main [README.md](README.md)
- Review [SETUP.md](SETUP.md)
- Open an issue on GitHub

---

**Last Updated**: 2024-02-27
