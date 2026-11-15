package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.dto.LineAssignmentResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class LineAssignmentRepository {

    public record LineBooking(Long lineId,
                              LocalDateTime startTime,
                              LocalDateTime endTime) {
    }

    private final JdbcTemplate jdbcTemplate;

    public LineAssignmentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<LineAssignmentResponse> rowMapper = (rs, rowNum) ->
            new LineAssignmentResponse(
                    rs.getLong("id"),
                    rs.getLong("line_id"),
                    rs.getString("line_code"),
                    rs.getString("line_name"),
                    rs.getTimestamp("start_time").toLocalDateTime(),
                    rs.getTimestamp("end_time").toLocalDateTime(),
                    rs.getBigDecimal("allocated_hours")
            );

    public LineAssignmentResponse save(Long taskId,
                                       Long lineId,
                                       LocalDateTime startTime,
                                       LocalDateTime endTime,
                                       BigDecimal allocatedHours) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO production_line_assignment
                    (production_task_id, line_id, start_time, end_time,
                     allocated_hours)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
                """,
                (rs, rowNum) -> new LineAssignmentResponse(
                        rs.getLong("id"),
                        rs.getLong("line_id"),
                        null,
                        null,
                        rs.getTimestamp("start_time").toLocalDateTime(),
                        rs.getTimestamp("end_time").toLocalDateTime(),
                        rs.getBigDecimal("allocated_hours")
                ),
                taskId,
                lineId,
                startTime,
                endTime,
                allocatedHours
        );
    }

    public List<LineAssignmentResponse> findByTaskId(Long taskId) {
        return jdbcTemplate.query("""
                SELECT a.id, a.line_id, l.code AS line_code, l.name AS line_name,
                       a.start_time, a.end_time, a.allocated_hours
                FROM production_line_assignment a
                JOIN production_line l ON l.id = a.line_id
                WHERE a.production_task_id = ?
                ORDER BY a.start_time, a.id
                """,
                rowMapper,
                taskId
        );
    }

    public int deleteByTaskId(Long taskId) {
        return jdbcTemplate.update(
                "DELETE FROM production_line_assignment WHERE production_task_id = ?",
                taskId
        );
    }

    public List<LineBooking> findCommittedBookings() {
        return jdbcTemplate.query("""
                SELECT a.line_id, a.start_time, a.end_time
                FROM production_line_assignment a
                JOIN production_task t ON t.id = a.production_task_id
                JOIN production_plan p ON p.id = t.plan_id
                WHERE p.status IN ('CONFIRMED', 'IN_PROGRESS')
                ORDER BY a.line_id, a.start_time
                """,
                (rs, rowNum) -> new LineBooking(
                        rs.getLong("line_id"),
                        rs.getTimestamp("start_time").toLocalDateTime(),
                        rs.getTimestamp("end_time").toLocalDateTime()
                )
        );
    }
}
