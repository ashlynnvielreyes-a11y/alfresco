-- =====================================================
-- AL FRESCO CAFE POS - SUPABASE CONNECTION MIGRATION
-- Adds missing schema needed by the current app:
-- - ingredient product code storage
-- - FIFO ingredient batches with expiration tracking
-- - combo meals and combo meal items
-- - add-ons
-- - admin settings seed
-- =====================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_product_code
  ON ingredients(product_code)
  WHERE product_code IS NOT NULL;

UPDATE ingredients
SET product_code = 'ING-' || LPAD(id::TEXT, 3, '0')
WHERE product_code IS NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'cashier', 'staff', 'manager'));

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('Coffee', 'Milk Tea', 'Fruit Tea', 'Silog'));

INSERT INTO categories (name, display_order)
VALUES ('Fruit Tea', 4)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS ingredient_batches (
  id TEXT PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_batches_ingredient
  ON ingredient_batches(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredient_batches_expiration
  ON ingredient_batches(expiration_date);

CREATE TABLE IF NOT EXISTS combo_meals (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_meal_items (
  id BIGSERIAL PRIMARY KEY,
  combo_id INT NOT NULL REFERENCES combo_meals(id) ON DELETE CASCADE,
  ingredient_id INT REFERENCES ingredients(id) ON DELETE SET NULL,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combo_meal_items_combo
  ON combo_meal_items(combo_id);

CREATE TABLE IF NOT EXISTS addons (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL CHECK (category IN ('drink', 'meal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE addons
SET category = 'drink'
WHERE category IS NULL;

ALTER TABLE addons
  ALTER COLUMN category SET DEFAULT 'drink';

ALTER TABLE addons
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE addons
  DROP CONSTRAINT IF EXISTS addons_category_check;

ALTER TABLE addons
  ADD CONSTRAINT addons_category_check
  CHECK (category IN ('drink', 'meal'));

CREATE TABLE IF NOT EXISTS admin_settings (
  id INT PRIMARY KEY,
  void_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_settings (id, void_key)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to ingredient batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public manage ingredient_batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public read access to combo meals" ON combo_meals;
DROP POLICY IF EXISTS "Allow public manage combo meals" ON combo_meals;
DROP POLICY IF EXISTS "Allow public read access to combo meal items" ON combo_meal_items;
DROP POLICY IF EXISTS "Allow public manage combo meal items" ON combo_meal_items;
DROP POLICY IF EXISTS "Allow public read access to add-ons" ON addons;
DROP POLICY IF EXISTS "Allow public manage add-ons" ON addons;

CREATE POLICY "Allow public read access to ingredient batches" ON ingredient_batches
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage ingredient_batches" ON ingredient_batches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to combo meals" ON combo_meals
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage combo meals" ON combo_meals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to combo meal items" ON combo_meal_items
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage combo meal items" ON combo_meal_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to add-ons" ON addons
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage add-ons" ON addons
  FOR ALL USING (true) WITH CHECK (true);
