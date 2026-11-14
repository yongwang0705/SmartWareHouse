package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.ResourceAssignment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class ResourceAssignmentRepository {

    private final JdbcTemplate jdbcTemplate;

    public ResourceAssignmentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ResourceAssignment> rowMapper = (rs, rowNum) ->
            new ResourceAssignment(
                    rs.getLong("id"),
                    rs.getLong("production_task_id"),
                    rs.getLong("operation_id"),
                    rs.getLong("work_center_id"),
                    rs.getLong("employee_id"),
                    rs.getTimestamp("start_time").toLocalDateTime(),
                    rs.getTimestamp("end_time").toLocalDateTime(),
                    rs.getBigDecimal("allocated_hours"),
                    rs.getString("status")
            );

    public ResourceAssignment save(Long taskId,
                                   Long operationId,
                                   Long workCenterId,
                                   Long employeeId,
                                   LocalDateTime startTime,
                                   LocalDateTime endTime,
                                   BigDecimal allocatedHours) {

        return jdbcTemplate.queryForObject("""
                INSERT INTO production_resource_assignment
                    (production_task_id, operation_id, work_center_id,
                     employee_id, start_time, end_time, allocated_hours, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ALLOCATED')
                RETURNING *
                """,
                rowMapper,
                taskId,
                operationId,
                workCenterId,
                employeeId,
                startTime,
                endTime,
                allocatedHours
        );
    }

    public List<ResourceAssignment> findByTaskId(Long taskId) {
        return jdbcTemplate.query(
                "SELECT * FROM production_resource_assignment WHERE production_task_id = ? ORDER BY start_time, id",
                rowMapper,
                taskId
        );
    }

    public List<ResourceAssignment> findByPlanId(Long planId) {
        return jdbcTemplate.query("""
                SELECT a.*
                FROM production_resource_assignment a
                JOIN production_task t ON t.id = a.production_task_id
                WHERE t.plan_id = ?
                ORDER BY a.start_time, a.id
                """, rowMapper, planId);
    }

    public List<ResourceAssignment> findAll() {
        return jdbcTemplate.query(
                "SELECT * FROM production_resource_assignment ORDER BY start_time, id",
                rowMapper
        );
    }

    /**
     * Assignments belonging to plans that already hold inventory and
     * resources. New draft plans must not overlap them.
     */
    public List<ResourceAssignment> findCommittedAssignments() {
        return jdbcTemplate.query("""
                SELECT a.*
                FROM production_resource_assignment a
                JOIN production_task t ON t.id = a.production_task_id
                JOIN production_plan p ON p.id = t.plan_id
                WHERE p.status IN ('CONFIRMED', 'IN_PROGRESS')
                ORDER BY a.start_time, a.id
                """, rowMapper);
    }
}
