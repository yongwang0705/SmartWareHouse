package com.ikwhere.smartwarehouse_order_service.repository;

import com.ikwhere.smartwarehouse_order_service.model.OrderItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class OrderItemRepository {
    private final JdbcTemplate jdbcTemplate;

    public OrderItemRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<OrderItem> rowMapper = (rs, rowNum) ->
            new OrderItem(
                    rs.getLong("id"),
                    rs.getLong("order_id"),
                    rs.getLong("product_id"),
                    rs.getString("product_name"),
                    rs.getInt("quantity"),
                    rs.getBigDecimal("unit_price")
            );

    public OrderItem save(OrderItem item) {

        String sql = """
            INSERT INTO order_items
            (order_id, product_id, product_name, quantity, unit_price)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                item.orderId(),
                item.productId(),
                item.productName(),
                item.quantity(),
                item.unitPrice()
        );
    }

    public List<OrderItem> findByOrderId(Long orderId) {

        return jdbcTemplate.query(
                "SELECT * FROM order_items WHERE order_id = ?",
                rowMapper,
                orderId
        );
    }
}
