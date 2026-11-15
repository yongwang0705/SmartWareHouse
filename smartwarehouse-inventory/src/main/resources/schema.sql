CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    min_stock_level INT NOT NULL DEFAULT 5,
    jit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_product BOOLEAN DEFAULT FALSE,
    CHECK (quantity >= 0),
    CHECK (reserved_quantity >= 0),
    CHECK (reserved_quantity <= quantity)
);

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_stock_level INT NOT NULL DEFAULT 5;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS jit_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_product BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS material_reservation (
    id BIGSERIAL PRIMARY KEY,
    reservation_reference VARCHAR(100) NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    CONSTRAINT uk_material_reservation UNIQUE (reservation_reference, product_id)
);

CREATE INDEX IF NOT EXISTS idx_material_reservation_reference
    ON material_reservation (reservation_reference);

CREATE TABLE IF NOT EXISTS product_bom (
    id BIGSERIAL PRIMARY KEY,
    parent_product_id BIGINT NOT NULL,
    component_product_id BIGINT NOT NULL,
    quantity_required INT NOT NULL DEFAULT 1,
    UNIQUE (parent_product_id, component_product_id)
);

CREATE TABLE IF NOT EXISTS kanban_bins (
    bin_id VARCHAR(50) PRIMARY KEY,
    product_id BIGINT NOT NULL,
    capacity INT NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    min_stock_threshold INT NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'FULL',
    last_triggered_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    surface_area NUMERIC(12, 2) NOT NULL CHECK (surface_area > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_plot (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    plot_type VARCHAR(30) NOT NULL DEFAULT 'RACK',
    surface_area NUMERIC(12, 2) NOT NULL CHECK (surface_area > 0),
    occupied_area NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (occupied_area >= 0 AND occupied_area <= surface_area),
    product_id BIGINT REFERENCES inventory(product_id) ON DELETE SET NULL,
    capacity_units INT NOT NULL DEFAULT 0 CHECK (capacity_units >= 0),
    occupied_units INT NOT NULL DEFAULT 0 CHECK (occupied_units >= 0),
    CONSTRAINT uk_warehouse_plot UNIQUE (warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_plot_warehouse
    ON warehouse_plot (warehouse_id);

CREATE TABLE IF NOT EXISTS production_work_orders (
    work_order_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    ordered_quantity INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SENT',
    expected_delivery TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP
);
