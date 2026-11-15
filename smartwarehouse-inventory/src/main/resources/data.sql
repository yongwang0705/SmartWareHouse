INSERT INTO inventory (product_id, product_name, quantity, min_stock_level, jit_enabled, is_product)
VALUES
    (101, 'Laptop', 20, 5, TRUE, TRUE),
    (102, 'Keyboard', 100, 10, TRUE, FALSE),
    (103, 'Mouse', 200, 15, TRUE, FALSE),
    (201, 'Keycap Set', 150, 20, TRUE, FALSE),
    (202, 'Key Switch Set', 150, 20, TRUE, FALSE),
    (203, 'Keyboard PCB', 120, 15, TRUE, FALSE),
    (204, 'USB-C Cable', 200, 25, TRUE, FALSE),
    (205, 'Keyboard Case', 100, 10, TRUE, FALSE)
ON CONFLICT (product_id) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    min_stock_level = EXCLUDED.min_stock_level;

INSERT INTO product_bom (parent_product_id, component_product_id, quantity_required)
VALUES
    (101, 102, 1),
    (101, 103, 1),
    (102, 201, 1),
    (102, 202, 1),
    (102, 203, 1),
    (102, 204, 1),
    (102, 205, 1)
ON CONFLICT (parent_product_id, component_product_id) DO NOTHING;

INSERT INTO kanban_bins (bin_id, product_id, capacity, current_stock, min_stock_threshold, status)
VALUES
    ('BIN-LAPTOP-101', 101, 50, 20, 5, 'TRIGGERED'),
    ('BIN-KEYBOARD-102', 102, 100, 100, 10, 'FULL'),
    ('BIN-MOUSE-103', 103, 200, 200, 15, 'FULL'),
    ('BIN-KEYCAP-201', 201, 250, 150, 20, 'FULL'),
    ('BIN-SWITCH-202', 202, 250, 150, 20, 'FULL'),
    ('BIN-PCB-203', 203, 200, 120, 15, 'FULL'),
    ('BIN-CABLE-204', 204, 300, 200, 25, 'FULL'),
    ('BIN-CASE-205', 205, 150, 100, 10, 'FULL')
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

INSERT INTO warehouse (code, name, address, surface_area, status)
VALUES
    ('WH-CENTRAL', 'Central Distribution Center', '1200 Industrial Avenue, Toronto, ON', 1800, 'ACTIVE'),
    ('WH-EAST', 'East Fulfilment Hub', '88 Commerce Road, Oshawa, ON', 1200, 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO warehouse_plot
    (warehouse_id, code, name, plot_type, surface_area, occupied_area,
     product_id, capacity_units, occupied_units)
VALUES
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'A-01', 'Fast-mover rack A-01', 'RACK', 120, 90, 101, 100, 20),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'A-02', 'Keyboard rack A-02', 'RACK', 100, 70, 102, 300, 100),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'A-03', 'Keycap bin A-03', 'BIN', 40, 30, 201, 400, 150),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'B-01', 'Mouse pick face B-01', 'FLOOR', 300, 220, 103, 500, 200),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'B-02', 'Bulk reserve B-02', 'BULK', 250, 0, NULL, 0, 0),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'C-01', 'PCB bin C-01', 'BIN', 30, 28, 203, 300, 120),
    ((SELECT id FROM warehouse WHERE code = 'WH-CENTRAL'),
     'C-02', 'Switch rack C-02', 'RACK', 30, 22, 202, 300, 150),
    ((SELECT id FROM warehouse WHERE code = 'WH-EAST'),
     'E-01', 'Cable and case rack E-01', 'RACK', 90, 88, 204, 400, 200),
    ((SELECT id FROM warehouse WHERE code = 'WH-EAST'),
     'E-02', 'Case bin E-02', 'BIN', 50, 40, 205, 200, 100),
    ((SELECT id FROM warehouse WHERE code = 'WH-EAST'),
     'E-03', 'Inbound staging E-03', 'FLOOR', 220, 0, NULL, 0, 0),
    ((SELECT id FROM warehouse WHERE code = 'WH-EAST'),
     'E-04', 'Bulk overflow E-04', 'BULK', 120, 0, NULL, 0, 0)
ON CONFLICT (warehouse_id, code) DO NOTHING;
