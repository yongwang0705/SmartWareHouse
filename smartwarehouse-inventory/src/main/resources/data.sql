
INSERT INTO inventory (product_id, product_name, quantity)
VALUES
    (101, 'Laptop', 20),
    (102, 'Keyboard', 100),
    (103, 'Mouse', 200)
    ON CONFLICT (product_id) DO NOTHING;
