CREATE TABLE IF NOT EXISTS production_plan (
    id BIGSERIAL PRIMARY KEY,
    plan_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    planning_start TIMESTAMP NOT NULL,
    planning_end TIMESTAMP NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'PRIORITY_EARLIEST_DUE_DATE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_task (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES production_plan(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    due_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_bom (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    material_product_id BIGINT NOT NULL,
    quantity_per_unit INT NOT NULL CHECK (quantity_per_unit > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_product_material UNIQUE (product_id, material_product_id)
);

CREATE TABLE IF NOT EXISTS production_routing (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routing_operation (
    id BIGSERIAL PRIMARY KEY,
    routing_id BIGINT NOT NULL REFERENCES production_routing(id) ON DELETE CASCADE,
    sequence_number INT NOT NULL CHECK (sequence_number > 0),
    operation_name VARCHAR(100) NOT NULL,
    work_center_id BIGINT NOT NULL,
    skill_code VARCHAR(50) NOT NULL,
    minutes_per_unit NUMERIC(10, 2) NOT NULL CHECK (minutes_per_unit >= 0),
    setup_minutes NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (setup_minutes >= 0),
    CONSTRAINT uk_routing_sequence UNIQUE (routing_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS work_center (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    capacity_hours_per_day NUMERIC(5, 2) NOT NULL CHECK (capacity_hours_per_day > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS employee (
    id BIGSERIAL PRIMARY KEY,
    employee_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS employee_skill (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    skill_code VARCHAR(50) NOT NULL,
    proficiency VARCHAR(30) NOT NULL DEFAULT 'INTERMEDIATE',
    CONSTRAINT uk_employee_skill UNIQUE (employee_id, skill_code)
);

CREATE TABLE IF NOT EXISTS employee_shift (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    working_days VARCHAR(50) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS employee_unavailability (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    reason VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS production_resource_assignment (
    id BIGSERIAL PRIMARY KEY,
    production_task_id BIGINT NOT NULL REFERENCES production_task(id) ON DELETE CASCADE,
    operation_id BIGINT NOT NULL REFERENCES routing_operation(id),
    work_center_id BIGINT NOT NULL REFERENCES work_center(id),
    employee_id BIGINT NOT NULL REFERENCES employee(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    allocated_hours NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ALLOCATED'
);

CREATE TABLE IF NOT EXISTS production_material_requirement (
    id BIGSERIAL PRIMARY KEY,
    production_task_id BIGINT NOT NULL REFERENCES production_task(id) ON DELETE CASCADE,
    material_product_id BIGINT NOT NULL,
    required_quantity INT NOT NULL CHECK (required_quantity > 0),
    reserved_quantity INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS production_working_calendar (
    id BIGSERIAL PRIMARY KEY,
    work_date DATE NOT NULL UNIQUE,
    working_day BOOLEAN NOT NULL DEFAULT TRUE,
    start_time TIME DEFAULT '08:00:00',
    end_time TIME DEFAULT '17:00:00',
    description VARCHAR(255)
);
