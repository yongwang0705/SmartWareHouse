
CREATE TABLE IF NOT EXISTS inventory (
                                         id BIGSERIAL PRIMARY KEY,
                                         product_id BIGINT NOT NULL UNIQUE,
                                         product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (quantity >= 0),
    CHECK (reserved_quantity >= 0),
    CHECK (reserved_quantity <= quantity)
    );
