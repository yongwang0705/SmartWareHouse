INSERT INTO inventory (product_id, product_name, quantity, min_stock_level, jit_enabled)
VALUES
    (101, 'Laptop', 20, 5, TRUE),
    (102, 'Keyboard', 100, 10, TRUE),
    (103, 'Mouse', 200, 15, TRUE)
ON CONFLICT (product_id) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    quantity = EXCLUDED.quantity,
    min_stock_level = EXCLUDED.min_stock_level,
    jit_enabled = EXCLUDED.jit_enabled;

INSERT INTO product_bom (parent_product_id, component_product_id, quantity_required)
VALUES
    (101, 102, 1),
    (101, 103, 1)
ON CONFLICT (parent_product_id, component_product_id) DO NOTHING;

INSERT INTO kanban_bins (bin_id, product_id, capacity, current_stock, min_stock_threshold, status)
VALUES
    ('BIN-LAPTOP-101', 101, 50, 20, 5, 'TRIGGERED'),
    ('BIN-KEYBOARD-102', 102, 100, 100, 10, 'FULL'),
    ('BIN-MOUSE-103', 103, 200, 200, 15, 'FULL')
ON CONFLICT (bin_id) DO NOTHING;

INSERT INTO production_work_orders (product_id, quantity, status)
VALUES
    (101, 3, 'PLANNED'),
    (101, 1, 'IN_PRODUCTION');

INSERT INTO purchase_orders (product_id, supplier_id, ordered_quantity, status, expected_delivery)
VALUES
    (102, 1001, 500, 'SENT', CURRENT_TIMESTAMP + INTERVAL '7 days'),
    (103, 1002, 1000, 'SENT', CURRENT_TIMESTAMP + INTERVAL '7 days'),
    (101, 1003, 200, 'SENT', CURRENT_TIMESTAMP + INTERVAL '14 days');
