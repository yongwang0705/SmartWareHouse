package com.ikwhere.smartwarehouse_order_service.repository;

import com.ikwhere.smartwarehouse_order_service.model.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public class OrderRepository {

    private final JdbcTemplate jdbcTemplate;

    public OrderRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Order> rowMapper = (rs, rowNum) ->
            new Order(
                    rs.getLong("id"),
                    rs.getLong("customer_id"),
                    rs.getString("status"),
                    rs.getBigDecimal("total_amount"),
                    rs.getTimestamp("created_at").toLocalDateTime()
            );


    public Order save(Long customerId, BigDecimal totalAmount) {

        String sql = """
                INSERT INTO orders (customer_id, status, total_amount)
                VALUES (?, ?, ?)
                RETURNING *
                """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                customerId,
                "CREATED",
                totalAmount
        );
    }

    public Optional<Order> findById(Long id) {

        List<Order> orders = jdbcTemplate.query(
                "SELECT * FROM orders WHERE id = ?",
                rowMapper,
                id
        );

        return orders.stream().findFirst();
    }

    public List<Order> findAll() {

        return jdbcTemplate.query(
                "SELECT * FROM orders ORDER BY id DESC",
                rowMapper
        );
    }
}