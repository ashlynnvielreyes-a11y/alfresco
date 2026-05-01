-- =====================================================
-- AL FRESCO CAFE POS - SUPABASE CONNECTION MIGRATION
-- Adds missing schema needed by the current app:
-- - ingredient product code storage
-- - FIFO ingredient batches with expiration tracking
-- - server-side archival of expired batches
-- - combo meals and combo meal items
-- - add-ons
-- - admin settings seed
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

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

CREATE TABLE IF NOT EXISTS expiration_logs (
  id TEXT PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  batch_id TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expiration_date DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiration_logs_ingredient
  ON expiration_logs(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_expiration_logs_date
  ON expiration_logs(expiration_date);

CREATE TABLE IF NOT EXISTS product_expiration_logs (
  id TEXT PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  product_category VARCHAR(100) NOT NULL,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  batch_id TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expiration_date DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_expiration_logs_product
  ON product_expiration_logs(product_id);

CREATE INDEX IF NOT EXISTS idx_product_expiration_logs_date
  ON product_expiration_logs(expiration_date);

CREATE OR REPLACE FUNCTION archive_expired_ingredient_batches()
RETURNS TABLE(archived_batches INT, updated_products INT) AS $$
DECLARE
  archived_count INT := 0;
  product_count INT := 0;
BEGIN
  WITH expired_batches AS (
    SELECT
      ib.id,
      ib.ingredient_id,
      i.name AS ingredient_name,
      ib.quantity,
      ib.expiration_date
    FROM ingredient_batches ib
    JOIN ingredients i ON i.id = ib.ingredient_id
    WHERE ib.expiration_date IS NOT NULL
      AND ib.expiration_date < CURRENT_DATE
      AND ib.quantity > 0
  ),
  inserted_ingredient_logs AS (
    INSERT INTO expiration_logs (
      id,
      ingredient_id,
      ingredient_name,
      batch_id,
      quantity,
      expiration_date,
      logged_at
    )
    SELECT
      'exp-' || eb.ingredient_id || '-' || eb.id || '-' || eb.expiration_date::TEXT,
      eb.ingredient_id,
      eb.ingredient_name,
      eb.id,
      eb.quantity,
      eb.expiration_date,
      NOW()
    FROM expired_batches eb
    ON CONFLICT (id) DO UPDATE
    SET quantity = EXCLUDED.quantity,
        ingredient_name = EXCLUDED.ingredient_name
    RETURNING 1
  ),
  inserted_product_logs AS (
    INSERT INTO product_expiration_logs (
      id,
      product_id,
      product_name,
      product_category,
      ingredient_id,
      ingredient_name,
      batch_id,
      quantity,
      expiration_date,
      logged_at
    )
    SELECT
      'product-exp-' || p.id || '-' || eb.ingredient_id || '-' || eb.id || '-' || eb.expiration_date::TEXT,
      p.id,
      p.name,
      p.category,
      eb.ingredient_id,
      eb.ingredient_name,
      eb.id,
      eb.quantity,
      eb.expiration_date,
      NOW()
    FROM expired_batches eb
    JOIN product_ingredients pi ON pi.ingredient_id = eb.ingredient_id
    JOIN products p ON p.id = pi.product_id
    ON CONFLICT (id) DO UPDATE
    SET quantity = EXCLUDED.quantity,
        ingredient_name = EXCLUDED.ingredient_name,
        product_name = EXCLUDED.product_name,
        product_category = EXCLUDED.product_category
    RETURNING 1
  ),
  deleted_batches AS (
    DELETE FROM ingredient_batches ib
    USING expired_batches eb
    WHERE ib.id = eb.id
    RETURNING eb.ingredient_id
  ),
  affected_ingredients AS (
    SELECT DISTINCT ingredient_id FROM deleted_batches
  ),
  updated_ingredients AS (
    UPDATE ingredients i
    SET stock = COALESCE((
      SELECT SUM(ib.quantity)
      FROM ingredient_batches ib
      WHERE ib.ingredient_id = i.id
        AND ib.quantity > 0
        AND (ib.expiration_date IS NULL OR ib.expiration_date >= CURRENT_DATE)
    ), 0),
    updated_at = NOW()
    WHERE i.id IN (SELECT ingredient_id FROM affected_ingredients)
    RETURNING i.id
  )
  SELECT
    (SELECT COUNT(*) FROM deleted_batches),
    (SELECT COUNT(*) FROM inserted_product_logs)
  INTO archived_count, product_count;

  RETURN QUERY SELECT archived_count, product_count;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  PERFORM cron.unschedule('archive-expired-ingredient-batches');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'archive-expired-ingredient-batches',
  '5 * * * *',
  $$SELECT * FROM archive_expired_ingredient_batches();$$
)
WHERE NOT EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'archive-expired-ingredient-batches'
);

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
ALTER TABLE expiration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_expiration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to ingredient batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public manage ingredient_batches" ON ingredient_batches;
DROP POLICY IF EXISTS "Allow public read access to expiration logs" ON expiration_logs;
DROP POLICY IF EXISTS "Allow public manage expiration logs" ON expiration_logs;
DROP POLICY IF EXISTS "Allow public read access to product expiration logs" ON product_expiration_logs;
DROP POLICY IF EXISTS "Allow public manage product expiration logs" ON product_expiration_logs;
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

CREATE POLICY "Allow public read access to expiration logs" ON expiration_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage expiration logs" ON expiration_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to product expiration logs" ON product_expiration_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow public manage product expiration logs" ON product_expiration_logs
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
