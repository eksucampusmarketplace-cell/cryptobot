# Database Schema Setup Guide

## Problem

The `prisma db push` command hangs when using Supabase's Transaction Pooler (port 6543). This is a known limitation - the pooler is optimized for application queries, not schema operations.

## Solution

Run the SQL schema manually in Supabase Dashboard. This is the most reliable method for setting up the database.

## Steps to Create Database Tables

### 1. Log in to Supabase Dashboard

Go to: https://supabase.com/dashboard

### 2. Select Your Project

Choose the project with reference `tlspsfhldwckhgbcktuf`

### 3. Open SQL Editor

1. In the left sidebar, click on **SQL Editor**
2. Click **New Query** to create a new SQL query

### 4. Run the Schema SQL

Copy the complete SQL from `schema.sql` file (or below) and paste it into the SQL Editor.

Click **Run** to execute the SQL.

## Complete SQL Schema

```sql
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "privateKey" TEXT,
    "publicKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "type" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountUsd" DOUBLE PRECISION,
    "txHash" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "exchangeRate" DOUBLE PRECISION,
    "feePercent" DOUBLE PRECISION,
    "feeAmount" DOUBLE PRECISION,
    "netAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "requiredConfirmations" INTEGER NOT NULL DEFAULT 3,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "bonusAmount" DOUBLE PRECISION,
    "bonusPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isFromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_rates" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "change24h" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE INDEX "wallets_address_idx" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txHash_key" ON "transactions"("txHash");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_txHash_idx" ON "transactions"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerId_referredId_key" ON "referrals"("referrerId", "referredId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_rates_symbol_key" ON "crypto_rates"("symbol");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 5. Verify Tables Were Created

1. Go to **Table Editor** in Supabase Dashboard
2. You should see all the tables created:
   - users
   - wallets
   - transactions
   - notifications
   - referrals
   - support_tickets
   - ticket_messages
   - settings
   - crypto_rates
   - audit_logs

## Next Steps

After creating the tables:

1. The application will work normally with the pooler connection (DATABASE_URL in .env)
2. The pooler connection is already configured correctly in your .env file
3. Run the application:
   ```bash
   npm run build
   npm start
   ```

## Why This Works

- **Manual SQL Execution**: Bypasses the Prisma schema engine limitations with pooler connections
- **Pooler for Queries**: Your application will still use the pooler connection (port 6543) which is optimized for queries
- **No Migrations Needed**: Since we created the tables directly, we don't need migration history

## For Future Schema Changes

If you need to modify the schema in the future:

1. Update `prisma/schema.prisma`
2. Generate new SQL using:
   ```bash
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```
3. Run the generated SQL manually in Supabase Dashboard

## Database Connection Details

Your current connection in `.env`:
```
DATABASE_URL="postgresql://postgres.tlspsfhldwckhgbcktuf:Decisivework1478@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

This connection will work perfectly for:
- Reading data from the database
- Writing data to the database
- Application queries

It will NOT work for:
- Prisma migrations
- Prisma db push
- Schema modifications (use manual SQL instead)

## Troubleshooting

### Error: "relation 'transactions' does not exist"

This means the tables haven't been created yet. Follow the steps above to run the SQL.

### Error: "prepared statement already exists"

This happens when using `prisma db push` with the pooler. Use manual SQL instead.

### Tables exist but application still shows errors

1. Verify DATABASE_URL is correct
2. Check if the pooler is accessible
3. Try running a simple query in Supabase Dashboard to test the tables

## Support

If you encounter issues:
1. Check Supabase logs in the Dashboard
2. Verify the tables exist in Table Editor
3. Ensure DATABASE_URL matches your Supabase project
