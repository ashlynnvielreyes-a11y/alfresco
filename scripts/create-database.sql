-- =====================================================
-- AL FRESCO CAFE POS SYSTEM - COMPLETE DATABASE SCHEMA
-- =====================================================
-- This script creates all necessary tables, indexes, 
-- functions, triggers, and Row Level Security policies
-- for the Al Fresco Cafe Point of Sale System.
-- =====================================================

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE
-- Stores user accounts for authentication
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster username/email lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- 2. INGREDIENTS TABLE
-- Stores raw ingredients and their stock levels
-- =====================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    stock DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 10,
    cost_per_unit DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for ingredient name searches
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

-- =====================================================
-- 3. CATEGORIES TABLE
-- Product categories for menu organization
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, display_order) VALUES
    ('Coffee', 1),
    ('Milk Tea', 2),
    ('Silog', 3),
    ('Pastry', 4)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 4. PRODUCTS TABLE
-- Menu items available for sale
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    category VARCHAR(50) CHECK (category IN ('Coffee', 'Milk Tea', 'Silog', 'Pastry')),
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for product queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);

-- =====================================================
-- 5. PRODUCT_INGREDIENTS TABLE (Junction Table)
-- Links products to their required ingredients with quantities
-- =====================================================
CREATE TABLE IF NOT EXISTS product_ingredients (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, ingredient_id)
);

-- Create indexes for junction table queries
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON product_ingredients(ingredient_id);

-- =====================================================
-- 6. INGREDIENT_PRODUCT_ASSIGNMENTS TABLE
-- Tracks which products an ingredient is assigned to
-- (Alternative view - for UI convenience)
-- =====================================================
CREATE TABLE IF NOT EXISTS ingredient_assignments (
    id SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ingredient_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ingredient_assignments_ingredient ON ingredient_assignments(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_assignments_product ON ingredient_assignments(product_id);

-- =====================================================
-- 7. TRANSACTIONS TABLE
-- Records all sales transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(20) NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cash_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
    change_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'gcash', 'maya')),
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    notes TEXT,
    cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_time TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- =====================================================
-- 8. TRANSACTION_ITEMS TABLE
-- Individual items within each transaction
-- =====================================================
CREATE TABLE IF NOT EXISTS transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for transaction items
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);

-- =====================================================
-- 9. INVENTORY_LOGS TABLE
-- Tracks all inventory changes (stock in/out)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('stock_in', 'stock_out', 'adjustment', 'sale', 'waste', 'return')),
    quantity_change DECIMAL(10, 2) NOT NULL,
    previous_stock DECIMAL(10, 2) NOT NULL,
    new_stock DECIMAL(10, 2) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for inventory log queries
CREATE INDEX IF NOT EXISTS idx_inventory_logs_ingredient ON inventory_logs(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs(created_at);

-- =====================================================
-- 10. DAILY_SALES_SUMMARY VIEW
-- Aggregated daily sales for reporting
-- =====================================================
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT 
    transaction_date,
    COUNT(*) as total_transactions,
    SUM(total_amount) as total_sales,
    AVG(total_amount) as average_transaction,
    SUM(cash_received) as total_cash_received
FROM transactions
WHERE status = 'completed'
GROUP BY transaction_date
ORDER BY transaction_date DESC;

-- =====================================================
-- 11. MONTHLY_SALES_SUMMARY VIEW
-- Aggregated monthly sales for reporting
-- =====================================================
CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT 
    DATE_TRUNC('month', transaction_date)::DATE as month,
    COUNT(*) as total_transactions,
    SUM(total_amount) as total_sales,
    AVG(total_amount) as average_transaction
FROM transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY month DESC;

-- =====================================================
-- 12. PRODUCT_SALES_SUMMARY VIEW
-- Product-wise sales statistics
-- =====================================================
CREATE OR REPLACE VIEW product_sales_summary AS
SELECT 
    ti.product_id,
    ti.product_name,
    p.category,
    COUNT(*) as times_sold,
    SUM(ti.quantity) as total_quantity_sold,
    SUM(ti.subtotal) as total_revenue
FROM transaction_items ti
LEFT JOIN products p ON ti.product_id = p.id
JOIN transactions t ON ti.transaction_id = t.id
WHERE t.status = 'completed'
GROUP BY ti.product_id, ti.product_name, p.category
ORDER BY total_revenue DESC;

-- =====================================================
-- 13. LOW_STOCK_INGREDIENTS VIEW
-- Ingredients that need restocking
-- =====================================================
CREATE OR REPLACE VIEW low_stock_ingredients AS
SELECT 
    id,
    name,
    unit,
    stock,
    min_stock_level,
    CASE 
        WHEN stock <= 0 THEN 'Out of Stock'
        WHEN stock <= min_stock_level THEN 'Low Stock'
        ELSE 'In Stock'
    END as stock_status
FROM ingredients
WHERE stock <= min_stock_level
ORDER BY stock ASC;

-- =====================================================
-- 14. PRODUCT_AVAILABILITY VIEW
-- Products with their available stock based on ingredients
-- =====================================================
CREATE OR REPLACE VIEW product_availability AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category,
    p.price,
    COALESCE(
        MIN(FLOOR(i.stock / NULLIF(pi.quantity, 0))),
        0
    )::INT as available_stock
FROM products p
LEFT JOIN product_ingredients pi ON p.id = pi.product_id
LEFT JOIN ingredients i ON pi.ingredient_id = i.id
WHERE p.is_available = true
GROUP BY p.id, p.name, p.category, p.price;

-- =====================================================
-- 15. FUNCTIONS
-- =====================================================

-- Function to generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    today_count INT;
    new_number VARCHAR(20);
BEGIN
    SELECT COUNT(*) + 1 INTO today_count
    FROM transactions
    WHERE transaction_date = CURRENT_DATE;
    
    new_number := 'TXN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(today_count::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct ingredients after a sale
CREATE OR REPLACE FUNCTION deduct_ingredients_for_sale(
    p_transaction_id UUID,
    p_product_id INT,
    p_quantity INT
)
RETURNS VOID AS $$
DECLARE
    ingredient_record RECORD;
    prev_stock DECIMAL(10, 2);
    new_stock_val DECIMAL(10, 2);
BEGIN
    FOR ingredient_record IN
        SELECT pi.ingredient_id, pi.quantity as required_quantity, i.stock as current_stock
        FROM product_ingredients pi
        JOIN ingredients i ON pi.ingredient_id = i.id
        WHERE pi.product_id = p_product_id
    LOOP
        prev_stock := ingredient_record.current_stock;
        new_stock_val := GREATEST(0, prev_stock - (ingredient_record.required_quantity * p_quantity));
        
        -- Update ingredient stock
        UPDATE ingredients
        SET stock = new_stock_val,
            updated_at = NOW()
        WHERE id = ingredient_record.ingredient_id;
        
        -- Log the inventory change
        INSERT INTO inventory_logs (
            ingredient_id,
            change_type,
            quantity_change,
            previous_stock,
            new_stock,
            reference_id,
            reference_type,
            notes
        ) VALUES (
            ingredient_record.ingredient_id,
            'sale',
            -(ingredient_record.required_quantity * p_quantity),
            prev_stock,
            new_stock_val,
            p_transaction_id,
            'transaction',
            'Deducted for sale'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check product availability
CREATE OR REPLACE FUNCTION check_product_availability(
    p_product_id INT,
    p_quantity INT DEFAULT 1
)
RETURNS TABLE(
    is_available BOOLEAN,
    available_quantity INT,
    missing_ingredients TEXT[]
) AS $$
DECLARE
    min_available INT := 999999;
    missing TEXT[] := ARRAY[]::TEXT[];
    ingredient_record RECORD;
    can_make INT;
BEGIN
    FOR ingredient_record IN
        SELECT 
            i.id,
            i.name,
            i.stock,
            i.unit,
            pi.quantity as required_quantity
        FROM product_ingredients pi
        JOIN ingredients i ON pi.ingredient_id = i.id
        WHERE pi.product_id = p_product_id
    LOOP
        can_make := FLOOR(ingredient_record.stock / NULLIF(ingredient_record.required_quantity, 0))::INT;
        
        IF can_make < min_available THEN
            min_available := can_make;
        END IF;
        
        IF ingredient_record.stock < (ingredient_record.required_quantity * p_quantity) THEN
            missing := array_append(
                missing,
                ingredient_record.name || ' (need ' || 
                (ingredient_record.required_quantity * p_quantity) || ' ' || 
                ingredient_record.unit || ', have ' || ingredient_record.stock || ')'
            );
        END IF;
    END LOOP;
    
    IF min_available = 999999 THEN
        min_available := 0;
    END IF;
    
    RETURN QUERY SELECT 
        (array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0),
        min_available,
        missing;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily sales
CREATE OR REPLACE FUNCTION get_daily_sales(p_date DATE)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(total_amount) FROM transactions 
         WHERE transaction_date = p_date AND status = 'completed'),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly sales
CREATE OR REPLACE FUNCTION get_monthly_sales(p_year INT, p_month INT)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(total_amount) FROM transactions 
         WHERE EXTRACT(YEAR FROM transaction_date) = p_year
         AND EXTRACT(MONTH FROM transaction_date) = p_month
         AND status = 'completed'),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 16. TRIGGERS
-- =====================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist before recreating
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_ingredients_updated_at ON ingredients;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS set_transaction_number_trigger ON transactions;

-- Create triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger function to auto-generate transaction number
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
        NEW.transaction_number := generate_transaction_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transaction_number_trigger
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_transaction_number();

-- =====================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (prevents duplicates)
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "Allow public read access to categories" ON categories;
DROP POLICY IF EXISTS "Allow public read access to product ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow public read access to ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public manage products" ON products;
DROP POLICY IF EXISTS "Allow public manage product_ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow public manage transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public manage transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow authenticated read inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "Allow authenticated insert inventory_logs" ON inventory_logs;
DROP POLICY IF EXISTS "Allow public read access to ingredient assignments" ON ingredient_assignments;
DROP POLICY IF EXISTS "Allow public manage ingredient_assignments" ON ingredient_assignments;
DROP POLICY IF EXISTS "Allow authenticated read access to ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage products" ON products;
DROP POLICY IF EXISTS "Allow authenticated manage product_ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Allow authenticated manage transactions" ON transactions;
DROP POLICY IF EXISTS "Allow authenticated manage transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow authenticated manage ingredient_assignments" ON ingredient_assignments;

-- Public read access for products and categories (for menu display)
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

CREATE POLICY "Allow public manage ingredients" ON ingredients
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage products" ON products
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage product_ingredients" ON product_ingredients
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage transactions" ON transactions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public manage transaction_items" ON transaction_items
    FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to view inventory logs
CREATE POLICY "Allow authenticated read inventory_logs" ON inventory_logs
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert inventory logs
CREATE POLICY "Allow authenticated insert inventory_logs" ON inventory_logs
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow public manage ingredient_assignments" ON ingredient_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 18. SEED DATA - DEFAULT INGREDIENTS
-- =====================================================

INSERT INTO ingredients (name, unit, stock, min_stock_level) VALUES
    ('Rice', 'cups', 100, 20),
    ('Eggs', 'pcs', 50, 15),
    ('Tapa (Beef)', 'pcs', 30, 10),
    ('Longganisa', 'pcs', 40, 10),
    ('Hotdog', 'pcs', 35, 10),
    ('Bangus', 'pcs', 25, 8),
    ('Pork', 'pcs', 20, 8),
    ('Spam', 'pcs', 30, 10),
    ('Espresso Shot', 'shots', 100, 20),
    ('Milk', 'ml', 5000, 1000),
    ('White Chocolate Syrup', 'ml', 1000, 200),
    ('Caramel Syrup', 'ml', 1000, 200),
    ('Mocha Syrup', 'ml', 1000, 200),
    ('Vanilla Syrup', 'ml', 800, 150),
    ('Whipped Cream', 'ml', 500, 100),
    ('Black Tea', 'bags', 50, 10),
    ('Green Tea', 'bags', 50, 10),
    ('Taro Powder', 'g', 500, 100),
    ('Matcha Powder', 'g', 300, 50),
    ('Brown Sugar Syrup', 'ml', 800, 150),
    ('Tapioca Pearls', 'g', 1000, 200),
    ('Cream Cheese', 'g', 500, 100),
    ('Strawberry Syrup', 'ml', 500, 100),
    ('Chocolate Powder', 'g', 400, 80),
    ('Flour', 'g', 2000, 500),
    ('Sugar', 'g', 1500, 300),
    ('Butter', 'g', 800, 200),
    ('Yeast', 'g', 200, 50),
    ('Chocolate Chips', 'g', 500, 100),
    ('Cream Filling', 'g', 400, 80),
    ('Cinnamon', 'g', 100, 20),
    ('Ube Powder', 'g', 300, 60)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 19. SEED DATA - DEFAULT PRODUCTS
-- =====================================================

INSERT INTO products (name, category, price, description, is_available) VALUES
    -- Coffee Products
    ('Americano', 'Coffee', 89.00, 'Classic espresso with hot water', true),
    ('Cafe Latte', 'Coffee', 109.00, 'Espresso with steamed milk', true),
    ('Cappuccino', 'Coffee', 109.00, 'Espresso with steamed milk and foam', true),
    ('White Mocha', 'Coffee', 129.00, 'Espresso with white chocolate and milk', true),
    ('Caramel Macchiato', 'Coffee', 129.00, 'Espresso with caramel and vanilla', true),
    ('Mocha', 'Coffee', 119.00, 'Espresso with chocolate and milk', true),
    ('Vanilla Latte', 'Coffee', 119.00, 'Espresso with vanilla and milk', true),
    ('Iced Coffee', 'Coffee', 99.00, 'Chilled espresso over ice', true),
    
    -- Milk Tea Products
    ('Classic Milk Tea', 'Milk Tea', 89.00, 'Traditional milk tea with pearls', true),
    ('Taro Milk Tea', 'Milk Tea', 99.00, 'Creamy taro flavored milk tea', true),
    ('Matcha Milk Tea', 'Milk Tea', 109.00, 'Japanese matcha with milk', true),
    ('Brown Sugar Milk Tea', 'Milk Tea', 109.00, 'Brown sugar with tiger stripes', true),
    ('Wintermelon Milk Tea', 'Milk Tea', 99.00, 'Sweet wintermelon flavored tea', true),
    ('Okinawa Milk Tea', 'Milk Tea', 109.00, 'Roasted brown sugar milk tea', true),
    ('Cream Cheese Milk Tea', 'Milk Tea', 119.00, 'Milk tea topped with cream cheese', true),
    ('Strawberry Milk Tea', 'Milk Tea', 99.00, 'Sweet strawberry flavored tea', true),
    
    -- Silog Products
    ('Tapsilog', 'Silog', 129.00, 'Beef tapa with garlic rice and egg', true),
    ('Longsilog', 'Silog', 119.00, 'Longganisa with garlic rice and egg', true),
    ('Hotsilog', 'Silog', 99.00, 'Hotdog with garlic rice and egg', true),
    ('Bangsilog', 'Silog', 139.00, 'Bangus with garlic rice and egg', true),
    ('Porksilog', 'Silog', 129.00, 'Pork chop with garlic rice and egg', true),
    ('Spamsilog', 'Silog', 119.00, 'Spam with garlic rice and egg', true),
    ('Cornsilog', 'Silog', 109.00, 'Corned beef with garlic rice and egg', true),
    ('Tosilog', 'Silog', 119.00, 'Tocino with garlic rice and egg', true),
    
    -- Pastry Products
    ('Croissant', 'Pastry', 69.00, 'Buttery flaky pastry', true),
    ('Chocolate Croissant', 'Pastry', 79.00, 'Croissant with chocolate filling', true),
    ('Cinnamon Roll', 'Pastry', 75.00, 'Sweet roll with cinnamon glaze', true),
    ('Blueberry Muffin', 'Pastry', 65.00, 'Moist muffin with blueberries', true),
    ('Chocolate Chip Cookie', 'Pastry', 45.00, 'Classic cookie with chocolate chips', true),
    ('Ensaymada', 'Pastry', 55.00, 'Sweet brioche with butter and cheese', true),
    ('Ube Pandesal', 'Pastry', 35.00, 'Purple yam flavored bread roll', true),
    ('Cheese Bread', 'Pastry', 45.00, 'Soft bread with cheese topping', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 20. SEED DATA - PRODUCT INGREDIENT ASSIGNMENTS
-- =====================================================

-- This maps ingredients to products with required quantities
-- Run this after products and ingredients are created

-- Get Coffee product IDs and assign ingredients
DO $$
DECLARE
    v_product_id INT;
    v_ingredient_id INT;
BEGIN
    -- Americano
    SELECT id INTO v_product_id FROM products WHERE name = 'Americano' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Espresso Shot' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 2)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;

    -- Cafe Latte
    SELECT id INTO v_product_id FROM products WHERE name = 'Cafe Latte' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Espresso Shot' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 2)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Milk' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 200)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;

    -- Tapsilog
    SELECT id INTO v_product_id FROM products WHERE name = 'Tapsilog' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Tapa (Beef)' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Rice' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Eggs' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;

    -- Longsilog
    SELECT id INTO v_product_id FROM products WHERE name = 'Longsilog' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Longganisa' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 2)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Rice' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Eggs' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;

    -- Classic Milk Tea
    SELECT id INTO v_product_id FROM products WHERE name = 'Classic Milk Tea' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Black Tea' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 1)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Milk' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 150)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Tapioca Pearls' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 30)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;

    -- Croissant
    SELECT id INTO v_product_id FROM products WHERE name = 'Croissant' LIMIT 1;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Flour' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 100)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ingredient_id FROM ingredients WHERE name = 'Butter' LIMIT 1;
    IF v_product_id IS NOT NULL AND v_ingredient_id IS NOT NULL THEN
        INSERT INTO product_ingredients (product_id, ingredient_id, quantity) 
        VALUES (v_product_id, v_ingredient_id, 50)
        ON CONFLICT (product_id, ingredient_id) DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- SCHEMA COMPLETE!
-- =====================================================
-- All tables, views, functions, triggers, and RLS 
-- policies have been created for the Al Fresco Cafe
-- Point of Sale System.
-- =====================================================
