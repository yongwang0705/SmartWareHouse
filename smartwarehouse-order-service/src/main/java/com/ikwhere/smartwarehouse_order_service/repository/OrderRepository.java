package com.ikwhere.smartwarehouse_order_service.repository;

import com.ikwhere.smartwarehouse_order_service.model.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getTimestamp("due_date").toLocalDateTime(),
                    rs.getString("priority"),
                    rs.getString("production_status")
            );


    public Order save(Long customerId, BigDecimal totalAmount,
                      LocalDateTime dueDate, String priority) {

        String sql = """
                INSERT INTO orders (customer_id, status, total_amount, due_date, priority)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
                """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                customerId,
                "CREATED",
                totalAmount,
                dueDate,
                priority
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

    /**
     * Orders that are still waiting for production planning, whose requested
     * due date falls inside the planning window. Cancelled orders are excluded.
     */
    public List<Order> findPendingForPlanning(LocalDate planningStart, LocalDate planningEnd) {

        String sql = """
                SELECT *
                FROM orders
                WHERE status <> 'CANCELLED'
                  AND production_status = 'PENDING_PRODUCTION'
                  AND due_date >= ?
                  AND due_date < ?
                ORDER BY due_date ASC, id ASC
                """;

        return jdbcTemplate.query(
                sql,
                rowMapper,
                planningStart.atStartOfDay(),
                planningEnd.plusDays(1).atStartOfDay()
        );
    }

    public int updateStatus(Long orderId, String status) {

        String sql = """
            UPDATE orders
            SET status = ?
            WHERE id = ?
            """;

        return jdbcTemplate.update(sql, status, orderId);
    }

    public int updateProductionStatus(Long orderId, String productionStatus) {

        String sql = """
            UPDATE orders
            SET production_status = ?
            WHERE id = ? AND status <> 'CANCELLED'
            """;

        return jdbcTemplate.update(sql, productionStatus, orderId);
    }
}
