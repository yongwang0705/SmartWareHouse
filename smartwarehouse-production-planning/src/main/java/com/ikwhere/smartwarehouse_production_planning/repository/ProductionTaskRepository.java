package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.ProductionTask;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class ProductionTaskRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProductionTaskRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ProductionTask> rowMapper = (rs, rowNum) ->
            new ProductionTask(
                    rs.getLong("id"),
                    rs.getLong("plan_id"),
                    rs.getLong("order_id"),
                    rs.getLong("product_id"),
                    rs.getInt("quantity"),
                    rs.getTimestamp("due_date").toLocalDateTime(),
                    rs.getTimestamp("start_time") == null
                            ? null
                            : rs.getTimestamp("start_time").toLocalDateTime(),
                    rs.getTimestamp("end_time") == null
                            ? null
                            : rs.getTimestamp("end_time").toLocalDateTime(),
                    rs.getString("priority"),
                    rs.getString("status"),
                    rs.getString("status_reason"),
                    rs.getTimestamp("estimated_completion") == null
                            ? null
                            : rs.getTimestamp("estimated_completion").toLocalDateTime(),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getTimestamp("updated_at").toLocalDateTime()
            );

    public ProductionTask save(Long planId,
                               Long orderId,
                               Long productId,
                               Integer quantity,
                               LocalDateTime dueDate,
                               LocalDateTime startTime,
                               LocalDateTime endTime,
                               String priority,
                               String status,
                               String statusReason,
                               LocalDateTime estimatedCompletion) {

        return jdbcTemplate.queryForObject("""
                INSERT INTO production_task
                    (plan_id, order_id, product_id, quantity, due_date,
                     start_time, end_time, priority, status, status_reason,
                     estimated_completion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING *
                """,
                rowMapper,
                planId,
                orderId,
                productId,
                quantity,
                dueDate,
                startTime,
                endTime,
                priority,
                status,
                statusReason,
                estimatedCompletion
        );
    }

    public Optional<ProductionTask> findById(Long id) {
        return jdbcTemplate.query(
                "SELECT * FROM production_task WHERE id = ?",
                rowMapper,
                id
        ).stream().findFirst();
    }

    public List<ProductionTask> findByPlanId(Long planId) {
        return jdbcTemplate.query(
                "SELECT * FROM production_task WHERE plan_id = ? ORDER BY id",
                rowMapper,
                planId
        );
    }

    public List<ProductionTask> findByOrderId(Long orderId) {
        return jdbcTemplate.query(
                "SELECT * FROM production_task WHERE order_id = ? ORDER BY id",
                rowMapper,
                orderId
        );
    }

    public List<ProductionTask> findAll() {
        return jdbcTemplate.query(
                "SELECT * FROM production_task ORDER BY id DESC",
                rowMapper
        );
    }

    public int updateStatus(Long id, String status) {
        return jdbcTemplate.update("""
                UPDATE production_task
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, status, id);
    }

    public void cancelByPlan(Long planId) {
        jdbcTemplate.update("""
                UPDATE production_task
                SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
                WHERE plan_id = ? AND status <> 'COMPLETED'
                """, planId);
    }

    public int countByPlanIdAndStatusNot(Long planId, String status) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM production_task
                WHERE plan_id = ? AND status <> ?
                """, Integer.class, planId, status);

        return count == null ? 0 : count;
    }
}
