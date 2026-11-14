package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.ProductionPlan;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ProductionPlanRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProductionPlanRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ProductionPlan> rowMapper = (rs, rowNum) ->
            new ProductionPlan(
                    rs.getLong("id"),
                    rs.getString("plan_number"),
                    rs.getString("status"),
                    rs.getTimestamp("planning_start").toLocalDateTime(),
                    rs.getTimestamp("planning_end").toLocalDateTime(),
                    rs.getString("algorithm"),
                    rs.getString("reservation_reference"),
                    rs.getString("failure_reason"),
                    rs.getTimestamp("created_at").toLocalDateTime(),
                    rs.getTimestamp("updated_at").toLocalDateTime()
            );

    public ProductionPlan create(LocalDateTime planningStart,
                                 LocalDateTime planningEnd,
                                 String algorithm) {

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO production_plan
                    (plan_number, status, planning_start, planning_end, algorithm)
                VALUES (?, 'DRAFT', ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                "TMP-" + UUID.randomUUID(),
                planningStart,
                planningEnd,
                algorithm
        );

        String planNumber = "PLAN-%d-%04d".formatted(planningStart.getYear(), id);

        jdbcTemplate.update(
                "UPDATE production_plan SET plan_number = ? WHERE id = ?",
                planNumber,
                id
        );

        return findById(id).orElseThrow();
    }

    public Optional<ProductionPlan> findById(Long id) {
        return jdbcTemplate.query(
                "SELECT * FROM production_plan WHERE id = ?",
                rowMapper,
                id
        ).stream().findFirst();
    }

    public List<ProductionPlan> findAll() {
        return jdbcTemplate.query(
                "SELECT * FROM production_plan ORDER BY id DESC",
                rowMapper
        );
    }

    /**
     * Atomically moves a plan from DRAFT/VALIDATED to VALIDATING. Only one
     * caller can win, which prevents concurrent confirmations.
     */
    public boolean claimForValidation(Long id) {
        int updated = jdbcTemplate.update("""
                UPDATE production_plan
                SET status = 'VALIDATING', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND status IN ('DRAFT', 'VALIDATED')
                """, id);

        return updated == 1;
    }

    public void markConfirmed(Long id, String reservationReference) {
        jdbcTemplate.update("""
                UPDATE production_plan
                SET status = 'CONFIRMED',
                    reservation_reference = ?,
                    failure_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, reservationReference, id);
    }

    public void markDraft(Long id, String failureReason) {
        jdbcTemplate.update("""
                UPDATE production_plan
                SET status = 'DRAFT',
                    failure_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, failureReason, id);
    }

    public void updateStatus(Long id, String status) {
        jdbcTemplate.update("""
                UPDATE production_plan
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, status, id);
    }

    public void recordFailure(Long id, String failureReason) {
        jdbcTemplate.update("""
                UPDATE production_plan
                SET failure_reason = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, failureReason, id);
    }

    public void clearFailure(Long id) {
        jdbcTemplate.update("""
                UPDATE production_plan
                SET failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, id);
    }
}
