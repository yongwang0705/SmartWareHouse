package com.ikwhere.smartwarehouse_order_service.repository;

import com.ikwhere.smartwarehouse_order_service.dto.DeliverySelectionRequest;
import com.ikwhere.smartwarehouse_order_service.model.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
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
                    rs.getString("production_status"),
                    rs.getString("delivery_mode"),
                    rs.getString("delivery_carrier"),
                    rs.getString("delivery_destination"),
                    rs.getBigDecimal("delivery_distance_km"),
                    rs.getObject("delivery_transit_days", Integer.class),
                    rs.getBigDecimal("delivery_price"),
                    rs.getString("delivery_container"),
                    toLocalDateTime(rs.getTimestamp("delivered_at"))
            );

    private static LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }


    public Order save(Long customerId, BigDecimal totalAmount,
                      LocalDateTime dueDate, String priority) {

        String sql = """
                INSERT INTO orders
                    (customer_id, status, total_amount, due_date, priority,
                     production_status)
                VALUES (?, ?, ?, ?, ?, 'AWAITING_CONFIRMATION')
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
                WHERE status = 'CONFIRMED'
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

    public int confirmOrder(Long orderId, String productionStatus) {

        String sql = """
            UPDATE orders
            SET status = 'CONFIRMED',
                production_status = ?
            WHERE id = ?
              AND status = 'CREATED'
            """;

        return jdbcTemplate.update(sql, productionStatus, orderId);
    }

    public int completeOrder(Long orderId) {

        String sql = """
            UPDATE orders
            SET status = 'COMPLETED',
                production_status = 'FULFILLED'
            WHERE id = ?
              AND status = 'CONFIRMED'
            """;

        return jdbcTemplate.update(sql, orderId);
    }

    public int storeOrder(Long orderId) {

        String sql = """
            UPDATE orders
            SET status = 'IN_WAREHOUSE'
            WHERE id = ?
              AND status = 'COMPLETED'
            """;

        return jdbcTemplate.update(sql, orderId);
    }

    public int shipOrder(Long orderId,
                         DeliverySelectionRequest delivery) {

        String sql = """
            UPDATE orders
            SET status = 'SHIPPED',
                delivery_mode = ?,
                delivery_carrier = ?,
                delivery_destination = ?,
                delivery_distance_km = ?,
                delivery_transit_days = ?,
                delivery_price = ?,
                delivery_container = ?,
                delivered_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status IN ('COMPLETED', 'IN_WAREHOUSE')
            """;

        return jdbcTemplate.update(
                sql,
                delivery.mode().trim().toUpperCase(Locale.ROOT),
                delivery.carrier(),
                delivery.destination(),
                delivery.distanceKm(),
                delivery.transitDays(),
                delivery.price(),
                delivery.container(),
                orderId
        );
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
