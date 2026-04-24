-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;

-- Disable RLS temporarily to recreate it
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for local user IDs (user_id is now a text field matching local user IDs)
-- Allow any user to read transactions (we'll filter by user_id in the app)
CREATE POLICY "Enable read access for all users" ON transactions
  FOR SELECT
  USING (true);

-- Allow insert for all transactions
CREATE POLICY "Enable insert for all users" ON transactions
  FOR INSERT
  WITH CHECK (true);

-- Allow update for all transactions
CREATE POLICY "Enable update for all users" ON transactions
  FOR UPDATE
  USING (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
