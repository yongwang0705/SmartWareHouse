package com.ikwhere.smartwarehouse_inventory.repository;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class InventoryRepository {

    private final JdbcTemplate jdbcTemplate;

    public InventoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Inventory> rowMapper = (rs, rowNum) ->
            new Inventory(
                    rs.getLong("id"),
                    rs.getLong("product_id"),
                    rs.getString("product_name"),
                    rs.getInt("quantity"),
                    rs.getInt("reserved_quantity"),
                    rs.getTimestamp("updated_at").toLocalDateTime()
            );

    public List<Inventory> findAll() {
        String sql = """
                SELECT id, product_id, product_name,
                       quantity, reserved_quantity, updated_at
                FROM inventory
                ORDER BY product_id
                """;

        return jdbcTemplate.query(sql, rowMapper);
    }

    public Optional<Inventory> findByProductId(Long productId) {
        String sql = """
                SELECT id, product_id, product_name,
                       quantity, reserved_quantity, updated_at
                FROM inventory
                WHERE product_id = ?
                """;

        return jdbcTemplate.query(sql, rowMapper, productId)
                .stream()
                .findFirst();
    }

    public boolean reserveStock(Long productId, Integer requestedQuantity) {
        String sql = """
                UPDATE inventory
                SET reserved_quantity = reserved_quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND quantity - reserved_quantity >= ?
                """;

        return jdbcTemplate.update(
                sql,
                requestedQuantity,
                productId,
                requestedQuantity
        ) == 1;
    }

    public boolean releaseStock(Long productId, Integer requestedQuantity) {
        String sql = """
                UPDATE inventory
                SET reserved_quantity = reserved_quantity - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND reserved_quantity >= ?
                """;

        return jdbcTemplate.update(
                sql,
                requestedQuantity,
                productId,
                requestedQuantity
        ) == 1;
    }

    public List<com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse> getBOM() {
        String sql = """
                SELECT b.parent_product_id, p1.product_name AS parent_product_name,
                       b.component_product_id, p2.product_name AS component_product_name,
                       b.quantity_required
                FROM product_bom b
                JOIN inventory p1 ON b.parent_product_id = p1.product_id
                JOIN inventory p2 ON b.component_product_id = p2.product_id
                ORDER BY b.parent_product_id, b.component_product_id
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) ->
                new com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse(
                        rs.getLong("parent_product_id"),
                        rs.getString("parent_product_name"),
                        rs.getLong("component_product_id"),
                        rs.getString("component_product_name"),
                        rs.getInt("quantity_required")
                )
        );
    }
}