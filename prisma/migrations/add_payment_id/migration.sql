-- Add paymentId column to transactions table for NOWPayments integration
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

-- Add index for faster lookups by paymentId
CREATE INDEX IF NOT EXISTS "transactions_paymentId_idx" ON transactions("paymentId");
