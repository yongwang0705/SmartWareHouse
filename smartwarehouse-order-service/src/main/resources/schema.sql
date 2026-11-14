CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Production planning metadata. Added with ALTER statements so that existing
-- databases created before the production planning service was introduced are
-- upgraded in place.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PRODUCTION';

UPDATE orders
SET due_date = created_at + INTERVAL '7 days'
WHERE due_date IS NULL;

ALTER TABLE orders ALTER COLUMN due_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders (due_date);
CREATE INDEX IF NOT EXISTS idx_orders_production_status ON orders (production_status);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
