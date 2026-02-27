# Database Setup Checklist

## Pre-Setup
- [x] Received error: "The table `public.transactions` does not exist in the current database"
- [x] Identified issue: Database tables not created
- [x] Understood root cause: Supabase pooler limitation with Prisma schema operations

## Environment Setup (COMPLETED)
- [x] Created `.env` file with correct DATABASE_URL
- [x] DATABASE_URL uses Supabase transaction pooler (port 6543)
- [x] SSL parameters configured (`sslmode=require`)
- [x] Dependencies installed (`npm install`)
- [x] Prisma client generated (`npm run db:generate`)

## Documentation Created (COMPLETED)
- [x] `schema.sql` - Complete database schema SQL
- [x] `QUICK_FIX.md` - 3-step quick fix guide
- [x] `DATABASE_SCHEMA_SETUP.md` - Detailed setup instructions
- [x] `FUTURE_MIGRATIONS.md` - Guide for schema changes
- [x] `DATABASE_FIX_SUMMARY.md` - Summary of all changes

## Action Items (YOU NEED TO DO THESE)

### Step 1: Create Database Tables (REQUIRED - DO THIS NOW!)
- [ ] Go to https://supabase.com/dashboard
- [ ] Select your project (`tlspsfhldwckhgbcktuf`)
- [ ] Click "SQL Editor" in the left sidebar
- [ ] Click "New Query"
- [ ] Open `schema.sql` file and copy all the SQL
- [ ] Paste into Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for confirmation message

### Step 2: Verify Tables
- [ ] Go to Supabase Dashboard → Table Editor
- [ ] Verify all 10 tables exist:
  - [ ] users
  - [ ] wallets
  - [ ] transactions
  - [ ] notifications
  - [ ] referrals
  - [ ] support_tickets
  - [ ] ticket_messages
  - [ ] settings
  - [ ] crypto_rates
  - [ ] audit_logs

### Step 3: Test Application
- [ ] Run: `npm run build`
- [ ] Run: `npm start`
- [ ] Check logs for successful database connection
- [ ] Verify no "table does not exist" errors
- [ ] Test application functionality

### Step 4: Deploy (If deploying to Render)
- [ ] Ensure tables are created in Supabase first
- [ ] Push code to repository
- [ ] Deploy to Render
- [ ] Verify deployment logs
- [ ] Test deployed application

## Post-Setup
- [ ] Application starts without database errors
- [ ] Deposit checker runs successfully
- [ ] All database operations work correctly
- [ ] Application is ready for use

## Files You Can Review

### Essential Files
- `.env` - Environment variables (contains DATABASE_URL)
- `schema.sql` - SQL to create all database tables
- `prisma/schema.prisma` - Prisma schema definition

### Documentation Files
- `QUICK_FIX.md` - Start here if you need help
- `DATABASE_FIX_SUMMARY.md` - Summary of what was done
- `DATABASE_SCHEMA_SETUP.md` - Detailed setup guide
- `FUTURE_MIGRATIONS.md` - How to modify schema in future

## Quick Reference

### Your Database Connection
```
Host: aws-1-eu-west-1.pooler.supabase.com
Port: 6543
Database: postgres
User: postgres.tlspsfhldwckhgbcktuf
SSL: Required
```

### Supabase Dashboard
https://supabase.com/dashboard

### Key Points to Remember
1. **Always use SQL Editor for schema changes** - Don't use `prisma db push`
2. **Pooler is for queries** - Use port 6543 for application (already configured)
3. **Manual SQL for schema** - Run SQL in Supabase Dashboard for table changes
4. **Verify after changes** - Always check tables exist in Table Editor

## Troubleshooting

### If tables still don't exist after running SQL:
1. Refresh Supabase Dashboard page
2. Check SQL Editor for errors in the query execution
3. Make sure you ran all the SQL (it's long!)
4. Try running it again

### If application still shows errors:
1. Check DATABASE_URL in `.env` is correct
2. Restart application after creating tables
3. Check application logs for specific errors
4. Verify you're using the correct `.env` file (not `.env.example`)

### If connection fails:
1. Verify DATABASE_URL format
2. Check Supabase project is active
3. Ensure pooler connection is accessible
4. Review error messages in logs

## Next Steps After Setup

Once everything is working:

1. Configure other environment variables:
   - TELEGRAM_BOT_TOKEN
   - ADMIN_CHAT_ID
   - PAYSTACK_SECRET_KEY
   - NOWPAYMENTS_API_KEY
   - WALLET_ENCRYPTION_KEY

2. Test application features:
   - User registration
   - Deposit flow
   - Withdrawal flow
   - Admin features

3. Deploy to production:
   - Follow RENDER_DEPLOYMENT.md
   - Ensure all env vars are set in Render
   - Test deployed application

## Support

If you need help:
- Check `DATABASE_SCHEMA_SETUP.md` for detailed troubleshooting
- Review Supabase Dashboard logs
- Check application logs for specific errors

---

**Remember**: The most important step is running the SQL in Supabase Dashboard. Do that first, then test the application!
