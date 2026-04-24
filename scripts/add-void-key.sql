-- Add void_key column to admin_settings table
-- This allows admin to set a void key that cashiers need to void transactions

-- First, check if admin_settings table exists, if not create it
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  void_key TEXT DEFAULT '1111',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add void_key column if it doesn't exist (for existing tables)
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS void_key TEXT DEFAULT '1111';

-- Insert default row if table is empty
INSERT INTO admin_settings (id, void_key)
VALUES (1, '1111')
ON CONFLICT (id) DO UPDATE SET
  void_key = COALESCE(admin_settings.void_key, '1111'),
  updated_at = NOW();

-- Verify the setup
SELECT * FROM admin_settings;
