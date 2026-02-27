# Quick Fix: Database Tables Missing

## The Problem

Your application is showing this error:
```
The table `public.transactions` does not exist in the current database.
```

This happens because Prisma couldn't create the database tables automatically.

## The Solution (3 Simple Steps)

### Step 1: Copy the SQL

The complete SQL is in the file `schema.sql` in your project directory. You can also find it in `DATABASE_SCHEMA_SETUP.md`.

### Step 2: Run it in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste the SQL from `schema.sql`
6. Click **Run**

### Step 3: Restart Your Application

After running the SQL, the tables will be created. Your application should work normally now.

```bash
npm run build
npm start
```

## What This Does

The SQL creates all 10 database tables your application needs:
- users (for Telegram user data)
- wallets (for crypto wallet addresses)
- transactions (the table that was missing!)
- notifications
- referrals
- support_tickets
- ticket_messages
- settings
- crypto_rates
- audit_logs

## Why This Manual Setup?

Supabase's connection pooler (port 6543) has limitations with Prisma's schema operations. Running SQL manually bypasses this issue while still allowing your app to use the pooler for fast queries.

## Your Database Connection

Your `.env` file already has the correct database connection configured:
```
DATABASE_URL="postgresql://postgres.tlspsfhldwckhgbcktuf:Decisivework1478@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

This will work perfectly for all application queries after you create the tables.

## Need Help?

If you have any issues:
1. Check that all tables are created in Supabase Dashboard → Table Editor
2. Verify the DATABASE_URL in your .env file
3. Check the application logs for specific errors
