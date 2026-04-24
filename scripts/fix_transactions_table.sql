-- Add transaction_number column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_number TEXT;

-- Update RLS policies to allow access based on local user IDs
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;

-- Disable and re-enable RLS to start fresh
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create permissive policies - filtering will be done in the app
CREATE POLICY "Enable read access for all users" ON transactions
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users" ON transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON transactions
  FOR UPDATE
  USING (true);

-- Ensure we have proper indexes
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_voided_idx ON transactions(voided);
