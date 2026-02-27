# Database Fix - Add Missing paymentId Column

## Problem
The `transactions.paymentId` column is missing from the database, causing errors in the deposit checker.

## Solution

### Option 1: Run via Render Shell (Recommended)
1. Go to https://dashboard.render.com
2. Click on your cryptobot service
3. Click "Shell" tab
4. Run: `npx prisma db push`

### Option 2: Run SQL Directly
1. Go to https://dashboard.render.com
2. Click on your PostgreSQL database
3. Click "PostgreSQL Shell" or connect via psql
4. Run this SQL:
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
CREATE INDEX IF NOT EXISTS "transactions_paymentId_idx" ON transactions("paymentId");
```

### Option 3: Connect External Tool
Use the SQL file at `prisma/migrations/add_payment_id/migration.sql`

## Verification
After running the migration, the deposit checker errors should stop appearing in logs.
