-- Complete transactions table setup for POS system
-- This script ensures all columns exist with correct types

-- First, check if table exists. If it does, we'll alter it.
-- If columns don't exist, they will be added.

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS transaction_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS date TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS time TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS cash_received DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS processed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS voided BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert for all users" ON transactions;
DROP POLICY IF EXISTS "Enable update for all users" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;

-- Disable and re-enable RLS
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies (filtering will be done in the app via user_id)
CREATE POLICY "Enable read access for all users" ON transactions
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users" ON transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON transactions
  FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_voided_idx ON transactions(voided);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, created_at DESC);

-- Add created_at trigger if not exists (optional, for auto-updating timestamps)
-- This will be handled by the application, but keeping for safety
