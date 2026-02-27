# Supabase Setup Guide for CryptoBot

This guide walks you through setting up Supabase PostgreSQL database for CryptoBot.

## Why Supabase?

- **Fully managed PostgreSQL** - No server maintenance required
- **Real-time subscriptions** - Future-ready for live updates
- **Built-in authentication** - Ready for future authentication features
- **Auto-backups** - 7-day free backup retention
- **Free tier** - 500MB database, 1GB bandwidth/month
- **Easy migration** - Simple connection string setup

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up for a free account
3. Click **"New Project"**
4. Fill in project details:
   - Name: `cryptobot` (or any name you prefer)
   - Database Password: **Generate a strong password** and save it!
   - Region: Choose the region closest to your users
5. Click **"Create new project"**
6. Wait 1-2 minutes for the database to be provisioned

## Step 2: Get Database Connection String

1. In your Supabase project dashboard
2. Go to **Settings** → **Database**
3. Scroll down to **Connection String**
4. Select **URI** format
5. Copy the connection string, which looks like:

```
postgresql://postgres.[project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Important:** Use the connection string with `pooler` for better performance and connection limits.

## Step 3: Update .env File

Add the connection string to your `.env` file:

```env
# Supabase Database Connection
DATABASE_URL="postgresql://postgres.[your-project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

Replace the placeholders with your actual values:
- `[your-project-ref]` - Your project reference (found in Supabase dashboard URL)
- `[your-password]` - The database password you set when creating the project
- `[region]` - Your Supabase region (e.g., `us-east-1`, `eu-west-1`)

## Step 4: Initialize Database

Run the Prisma migration to create tables:

```bash
npm install
npm run db:push
```

This will create all required tables in your Supabase database.

## Step 5: Verify Connection

You can verify your connection by opening Prisma Studio:

```bash
npm run db:studio
```

This opens a web-based GUI to view and edit your data.

## Step 6: Security Settings (Recommended)

### Enable Row Level Security (RLS)

For production, enable RLS to secure your data:

1. Go to **SQL Editor** in Supabase dashboard
2. Run this query:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (basic - adjust as needed)
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (true);

-- Wallets can be viewed by owner
CREATE POLICY "Wallets view policy" ON wallets
  FOR SELECT USING (true);

CREATE POLICY "Wallets update policy" ON wallets
  FOR UPDATE USING (true);

-- Transactions visible to all (needed for admin)
CREATE POLICY "Transactions view policy" ON transactions
  FOR SELECT USING (true);

CREATE POLICY "Transactions update policy" ON transactions
  FOR UPDATE USING (true);

-- Allow all notifications (read-only)
CREATE POLICY "Notifications view policy" ON notifications
  FOR SELECT USING (true);
```

### Database Backups

Supabase includes:
- **Automatic backups**: Daily backups retained for 7 days (free tier)
- **Point-in-time recovery**: Available on paid plans
- **Manual backups**: Download anytime from dashboard

## Troubleshooting

### Connection Timeout

If you get timeout errors:
1. Check your connection string is correct
2. Verify the database password
3. Ensure your project status is "Active" in Supabase dashboard
4. Try the non-pooler connection string if pooler fails:
   ```
   postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
   ```

### Migration Errors

If `npm run db:push` fails:
1. Verify DATABASE_URL is set correctly
2. Check you have network access to Supabase
3. Ensure Supabase project status is "Active"
4. Check the error message in Prisma output

### Permission Errors

If you get permission errors:
1. Verify the database password is correct
2. Check the connection string format
3. Ensure you're using the correct project reference

## Monitoring

### Supabase Dashboard

Monitor your database at:
- **Database** → **Reports** - Query performance
- **Database** → **Logs** - Database logs
- **Database** → **Replication** - Replication status

### Queries to Monitor

In Supabase SQL Editor, run:

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Recent queries
SELECT
  datname,
  usename,
  state,
  query_start,
  query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start DESC;
```

## Migrating from SQLite

If you're migrating from SQLite to Supabase:

1. Export your SQLite data:
   ```bash
   npm run db:pull
   ```

2. Update your DATABASE_URL in `.env`

3. Push to Supabase:
   ```bash
   npm run db:push
   ```

4. Import data (manual via Supabase Dashboard or scripts)

## Backup Your Data

### Manual Backup

1. Go to **Settings** → **Database** in Supabase
2. Click **Backups** tab
3. Click **Create backup**
4. Download when ready

### Automated Backup (Optional)

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Cost Considerations

**Free Tier Limits:**
- 500MB database storage
- 1GB bandwidth per month
- 500MB file storage
- 2 concurrent connections (pooler)

**When to Upgrade:**
- Database > 500MB
- More than 2 concurrent users
- Higher bandwidth usage
- Need backups > 7 days

**Pro Tier starts at:** $25/month
- 8GB database
- 100GB bandwidth
- 50GB file storage
- 7-day backups
- Daily backups for 30 days

## Next Steps

1. Start the bot with `npm run dev`
2. Verify database connection in logs
3. Test with `/start` command
4. Monitor database size and performance

## Support

- Supabase Documentation: https://supabase.com/docs
- Supabase GitHub: https://github.com/supabase/supabase
- CryptoBot Issues: Report issues in this repository

---

**⚠️ Important:** Never commit your `.env` file with real database credentials. Always use environment variables and secure storage.
