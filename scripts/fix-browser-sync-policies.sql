-- =====================================================
-- AL FRESCO CAFE POS - BROWSER SYNC POLICY FIX
-- Run this in Supabase SQL Editor for an existing project.
-- It aligns RLS policies with the current app, which reads
-- and writes directly from the browser using the anon key.
-- =====================================================

-- Core tables used by the browser-based POS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Extended tables added by connect-pos-to-supabase.sql
ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE expiration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_expiration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

UPDATE ingredients
SET product_code = 'ING-' || LPAD(id::TEXT, 3, '0')
WHERE product_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_product_code
  ON ingredients(product_code)
  WHERE product_code IS NOT NULL;

-- Remove older authenticated-only policies
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "Allow public read access to categories" ON categories;
DROP POLICY IF EXISTS "Allow public read access to product ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow public read access to ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public read access to ingredient assignments" ON ingredient_assignments;
DROP POLICY IF EXISTS "Allow public read access to ingredient batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public read access to expiration logs" ON expiration_logs;
DROP POLICY IF EXISTS "Allow public read access to product expiration logs" ON product_expiration_logs;
DROP POLICY IF EXISTS "Allow public read access to combo meals" ON combo_meals;
DROP POLICY IF EXISTS "Allow public read access to combo meal items" ON combo_meal_items;
DROP POLICY IF EXISTS "Allow public read access to add-ons" ON addons;
DROP POLICY IF EXISTS "Allow public read access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public read access to transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Allow public manage products" ON products;
DROP POLICY IF EXISTS "Allow public manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public manage product_ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow public manage ingredient_assignments" ON ingredient_assignments;
DROP POLICY IF EXISTS "Allow public manage ingredient_batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public manage expiration logs" ON expiration_logs;
DROP POLICY IF EXISTS "Allow public manage product expiration logs" ON product_expiration_logs;
DROP POLICY IF EXISTS "Allow public manage combo meals" ON combo_meals;
DROP POLICY IF EXISTS "Allow public manage combo meal items" ON combo_meal_items;
DROP POLICY IF EXISTS "Allow public manage add-ons" ON addons;
DROP POLICY IF EXISTS "Allow public manage transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public manage transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow authenticated read access to ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage products" ON products;
DROP POLICY IF EXISTS "Allow authenticated manage product_ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage ingredient_assignments" ON ingredient_assignments;
DROP POLICY IF EXISTS "Allow authenticated manage transactions" ON transactions;
DROP POLICY IF EXISTS "Allow authenticated manage transaction_items" ON transaction_items;

-- Browser-readable tables
CREATE POLICY "Allow public read access to products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to product ingredients" ON product_ingredients
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to ingredients" ON ingredients
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to ingredient assignments" ON ingredient_assignments
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to ingredient batches" ON ingredient_batches
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to expiration logs" ON expiration_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to product expiration logs" ON product_expiration_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to combo meals" ON combo_meals
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to combo meal items" ON combo_meal_items
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to add-ons" ON addons
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to transactions" ON transactions
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to transaction items" ON transaction_items
  FOR SELECT USING (true);

-- Browser-writable tables
CREATE POLICY "Allow public manage products" ON products
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage ingredients" ON ingredients
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage product_ingredients" ON product_ingredients
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage ingredient_assignments" ON ingredient_assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage ingredient_batches" ON ingredient_batches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage expiration logs" ON expiration_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage product expiration logs" ON product_expiration_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage combo meals" ON combo_meals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage combo meal items" ON combo_meal_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage add-ons" ON addons
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage transaction_items" ON transaction_items
  FOR ALL USING (true) WITH CHECK (true);
