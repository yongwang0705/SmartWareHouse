-- Sample production configuration used by the end-to-end walkthrough in the
-- README. Every statement is idempotent, so existing configuration is kept.

INSERT INTO work_center (code, name, capacity_hours_per_day, active)
VALUES
    ('WC-ASSEMBLY', 'Assembly A', 8, TRUE),
    ('WC-TESTING', 'Testing A', 8, TRUE),
    ('WC-PACKAGING', 'Packaging A', 8, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO employee (employee_number, name, active)
VALUES
    ('EMP-A', 'Employee A', TRUE),
    ('EMP-B', 'Employee B', TRUE),
    ('EMP-C', 'Employee C', TRUE)
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employee_skill (employee_id, skill_code, proficiency)
SELECT e.id, 'ASSEMBLY', 'ADVANCED'
FROM employee e
WHERE e.employee_number = 'EMP-A'
ON CONFLICT (employee_id, skill_code) DO NOTHING;

INSERT INTO employee_skill (employee_id, skill_code, proficiency)
SELECT e.id, 'TESTING', 'ADVANCED'
FROM employee e
WHERE e.employee_number = 'EMP-B'
ON CONFLICT (employee_id, skill_code) DO NOTHING;

INSERT INTO employee_skill (employee_id, skill_code, proficiency)
SELECT e.id, 'PACKAGING', 'ADVANCED'
FROM employee e
WHERE e.employee_number = 'EMP-C'
ON CONFLICT (employee_id, skill_code) DO NOTHING;

INSERT INTO employee_shift
    (employee_id, shift_start, shift_end, working_days, active)
SELECT e.id, TIME '08:00', TIME '17:00', 'MON,TUE,WED,THU,FRI', TRUE
FROM employee e
WHERE e.employee_number IN ('EMP-A', 'EMP-B', 'EMP-C')
  AND NOT EXISTS (
      SELECT 1
      FROM employee_shift s
      WHERE s.employee_id = e.id
        AND s.shift_start = TIME '08:00'
        AND s.shift_end = TIME '17:00'
  );

INSERT INTO product_bom
    (product_id, material_product_id, quantity_per_unit, active)
VALUES
    (101, 102, 1, TRUE),
    (101, 103, 1, TRUE)
ON CONFLICT (product_id, material_product_id) DO NOTHING;

INSERT INTO production_routing (product_id, name, active)
SELECT 101, 'Laptop Standard Routing', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM production_routing
    WHERE product_id = 101 AND name = 'Laptop Standard Routing'
);

INSERT INTO production_routing (product_id, name, active)
SELECT 102, 'Keyboard Standard Routing', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM production_routing
    WHERE product_id = 102 AND name = 'Keyboard Standard Routing'
);

INSERT INTO production_routing (product_id, name, active)
SELECT 103, 'Mouse Standard Routing', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM production_routing
    WHERE product_id = 103 AND name = 'Mouse Standard Routing'
);

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 1, 'Assembly', w.id, 'ASSEMBLY', 10, 30
FROM production_routing r, work_center w
WHERE r.product_id = 101
  AND r.name = 'Laptop Standard Routing'
  AND w.code = 'WC-ASSEMBLY'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 2, 'Testing', w.id, 'TESTING', 5, 10
FROM production_routing r, work_center w
WHERE r.product_id = 101
  AND r.name = 'Laptop Standard Routing'
  AND w.code = 'WC-TESTING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 3, 'Packaging', w.id, 'PACKAGING', 3, 5
FROM production_routing r, work_center w
WHERE r.product_id = 101
  AND r.name = 'Laptop Standard Routing'
  AND w.code = 'WC-PACKAGING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 1, 'Assembly', w.id, 'ASSEMBLY', 5, 15
FROM production_routing r, work_center w
WHERE r.product_id = 102
  AND r.name = 'Keyboard Standard Routing'
  AND w.code = 'WC-ASSEMBLY'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 2, 'Testing', w.id, 'TESTING', 3, 5
FROM production_routing r, work_center w
WHERE r.product_id = 102
  AND r.name = 'Keyboard Standard Routing'
  AND w.code = 'WC-TESTING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 3, 'Packaging', w.id, 'PACKAGING', 2, 5
FROM production_routing r, work_center w
WHERE r.product_id = 102
  AND r.name = 'Keyboard Standard Routing'
  AND w.code = 'WC-PACKAGING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 1, 'Assembly', w.id, 'ASSEMBLY', 3, 10
FROM production_routing r, work_center w
WHERE r.product_id = 103
  AND r.name = 'Mouse Standard Routing'
  AND w.code = 'WC-ASSEMBLY'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 2, 'Testing', w.id, 'TESTING', 2, 5
FROM production_routing r, work_center w
WHERE r.product_id = 103
  AND r.name = 'Mouse Standard Routing'
  AND w.code = 'WC-TESTING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;

INSERT INTO routing_operation
    (routing_id, sequence_number, operation_name, work_center_id,
     skill_code, minutes_per_unit, setup_minutes)
SELECT r.id, 3, 'Packaging', w.id, 'PACKAGING', 1, 5
FROM production_routing r, work_center w
WHERE r.product_id = 103
  AND r.name = 'Mouse Standard Routing'
  AND w.code = 'WC-PACKAGING'
ON CONFLICT (routing_id, sequence_number) DO NOTHING;
