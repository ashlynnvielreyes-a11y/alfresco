-- Real-time active cashier order monitor for admin dashboard

CREATE TABLE IF NOT EXISTS active_orders (
  id TEXT PRIMARY KEY,
  cashier_user_id TEXT NOT NULL,
  cashier_name VARCHAR(100) NOT NULL,
  station_id VARCHAR(100) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(50) DEFAULT 'none',
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
  cart_item_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS active_orders_last_updated_idx
  ON active_orders(last_updated_at DESC);

CREATE INDEX IF NOT EXISTS active_orders_cashier_user_idx
  ON active_orders(cashier_user_id);

ALTER TABLE active_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON active_orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON active_orders;
DROP POLICY IF EXISTS "Enable update for all users" ON active_orders;
DROP POLICY IF EXISTS "Enable delete for all users" ON active_orders;

CREATE POLICY "Enable read access for all users" ON active_orders
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for all users" ON active_orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON active_orders
  FOR UPDATE
  USING (true);

CREATE POLICY "Enable delete for all users" ON active_orders
  FOR DELETE
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE active_orders;
