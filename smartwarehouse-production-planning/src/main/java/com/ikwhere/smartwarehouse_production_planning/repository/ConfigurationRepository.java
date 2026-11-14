package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.EmployeeUnavailability;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeSkill;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import com.ikwhere.smartwarehouse_production_planning.model.WorkingCalendarEntry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class ConfigurationRepository {
    private final JdbcTemplate jdbcTemplate;

    public ConfigurationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ProductBom> findBomsByProductId(Long productId) {
        return jdbcTemplate.query(
            "SELECT * FROM product_bom WHERE product_id = ? AND active = TRUE",
            (rs, rowNum) -> new ProductBom(
                rs.getLong("id"),
                rs.getLong("product_id"),
                rs.getLong("material_product_id"),
                rs.getInt("quantity_per_unit"),
                rs.getBoolean("active"),
                rs.getTimestamp("created_at").toLocalDateTime()
            ),
            productId
        );
    }

    public List<RoutingOperation> findOperationsByRoutingId(Long routingId) {
        return jdbcTemplate.query(
            "SELECT * FROM routing_operation WHERE routing_id = ? ORDER BY sequence_number ASC",
            (rs, rowNum) -> new RoutingOperation(
                rs.getLong("id"),
                rs.getLong("routing_id"),
                rs.getInt("sequence_number"),
                rs.getString("operation_name"),
                rs.getLong("work_center_id"),
                rs.getString("skill_code"),
                rs.getBigDecimal("minutes_per_unit"),
                rs.getBigDecimal("setup_minutes")
            ),
            routingId
        );
    }

    public List<EmployeeSkill> findEmployeeSkills(Long employeeId) {
        return jdbcTemplate.query(
            "SELECT * FROM employee_skill WHERE employee_id = ?",
            (rs, rowNum) -> new EmployeeSkill(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getString("skill_code"),
                rs.getString("proficiency")
            ),
            employeeId
        );
    }

    public List<EmployeeShift> findEmployeeShifts(Long employeeId) {
        return jdbcTemplate.query(
            "SELECT * FROM employee_shift WHERE employee_id = ? AND active = TRUE",
            (rs, rowNum) -> new EmployeeShift(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTime("shift_start").toLocalTime(),
                rs.getTime("shift_end").toLocalTime(),
                rs.getString("working_days"),
                rs.getBoolean("active")
            ),
            employeeId
        );
    }

    public List<EmployeeShift> findAllEmployeeShifts() {
        return jdbcTemplate.query(
            "SELECT * FROM employee_shift WHERE active = TRUE ORDER BY employee_id",
            (rs, rowNum) -> new EmployeeShift(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTime("shift_start").toLocalTime(),
                rs.getTime("shift_end").toLocalTime(),
                rs.getString("working_days"),
                rs.getBoolean("active")
            )
        );
    }

    public List<EmployeeSkill> findAllEmployeeSkills() {
        return jdbcTemplate.query(
            "SELECT * FROM employee_skill ORDER BY employee_id, skill_code",
            (rs, rowNum) -> new EmployeeSkill(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getString("skill_code"),
                rs.getString("proficiency")
            )
        );
    }

    public List<EmployeeUnavailability> findAllUnavailability() {
        return jdbcTemplate.query(
            "SELECT * FROM employee_unavailability ORDER BY employee_id, start_time",
            (rs, rowNum) -> new EmployeeUnavailability(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTimestamp("start_time").toLocalDateTime(),
                rs.getTimestamp("end_time").toLocalDateTime(),
                rs.getString("reason")
            )
        );
    }

    public Optional<ProductionRouting> findActiveRoutingByProductId(Long productId) {
        return jdbcTemplate.query(
            "SELECT * FROM production_routing WHERE product_id = ? AND active = TRUE ORDER BY id LIMIT 1",
            (rs, rowNum) -> new ProductionRouting(
                rs.getLong("id"),
                rs.getLong("product_id"),
                rs.getString("name"),
                rs.getBoolean("active")
            ),
            productId
        ).stream().findFirst();
    }

    public List<WorkingCalendarEntry> findWorkingCalendar(LocalDate from, LocalDate to) {
        return jdbcTemplate.query("""
            SELECT * FROM production_working_calendar
            WHERE work_date BETWEEN ? AND ?
            ORDER BY work_date
            """,
            (rs, rowNum) -> new WorkingCalendarEntry(
                rs.getLong("id"),
                rs.getDate("work_date").toLocalDate(),
                rs.getBoolean("working_day"),
                rs.getTime("start_time") == null
                        ? null
                        : rs.getTime("start_time").toLocalTime(),
                rs.getTime("end_time") == null
                        ? null
                        : rs.getTime("end_time").toLocalTime(),
                rs.getString("description")
            ),
            from,
            to
        );
    }

    public ProductBom saveBom(Long productId, Long materialProductId, Integer quantityPerUnit) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO product_bom (product_id, material_product_id, quantity_per_unit)
            VALUES (?, ?, ?)
            ON CONFLICT (product_id, material_product_id)
            DO UPDATE SET quantity_per_unit = EXCLUDED.quantity_per_unit,
                          active = TRUE
            RETURNING *
            """,
            (rs, rowNum) -> new ProductBom(
                rs.getLong("id"),
                rs.getLong("product_id"),
                rs.getLong("material_product_id"),
                rs.getInt("quantity_per_unit"),
                rs.getBoolean("active"),
                rs.getTimestamp("created_at").toLocalDateTime()
            ),
            productId,
            materialProductId,
            quantityPerUnit
        );
    }

    public RoutingOperation saveRoutingOperation(Long routingId,
                                                 Integer sequenceNumber,
                                                 String operationName,
                                                 Long workCenterId,
                                                 String skillCode,
                                                 java.math.BigDecimal minutesPerUnit,
                                                 java.math.BigDecimal setupMinutes) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO routing_operation
                (routing_id, sequence_number, operation_name, work_center_id,
                 skill_code, minutes_per_unit, setup_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (rs, rowNum) -> new RoutingOperation(
                rs.getLong("id"),
                rs.getLong("routing_id"),
                rs.getInt("sequence_number"),
                rs.getString("operation_name"),
                rs.getLong("work_center_id"),
                rs.getString("skill_code"),
                rs.getBigDecimal("minutes_per_unit"),
                rs.getBigDecimal("setup_minutes")
            ),
            routingId,
            sequenceNumber,
            operationName,
            workCenterId,
            skillCode,
            minutesPerUnit,
            setupMinutes
        );
    }

    public EmployeeSkill saveEmployeeSkill(Long employeeId,
                                           String skillCode,
                                           String proficiency) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO employee_skill (employee_id, skill_code, proficiency)
            VALUES (?, ?, ?)
            ON CONFLICT (employee_id, skill_code)
            DO UPDATE SET proficiency = EXCLUDED.proficiency
            RETURNING *
            """,
            (rs, rowNum) -> new EmployeeSkill(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getString("skill_code"),
                rs.getString("proficiency")
            ),
            employeeId,
            skillCode,
            proficiency
        );
    }

    public WorkingCalendarEntry saveWorkingCalendarEntry(LocalDate workDate,
                                                         boolean workingDay,
                                                         java.time.LocalTime startTime,
                                                         java.time.LocalTime endTime,
                                                         String description) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO production_working_calendar
                (work_date, working_day, start_time, end_time, description)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (work_date) DO UPDATE
            SET working_day = EXCLUDED.working_day,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                description = EXCLUDED.description
            RETURNING *
            """,
            (rs, rowNum) -> new WorkingCalendarEntry(
                rs.getLong("id"),
                rs.getDate("work_date").toLocalDate(),
                rs.getBoolean("working_day"),
                rs.getTime("start_time") == null
                        ? null
                        : rs.getTime("start_time").toLocalTime(),
                rs.getTime("end_time") == null
                        ? null
                        : rs.getTime("end_time").toLocalTime(),
                rs.getString("description")
            ),
            workDate,
            workingDay,
            startTime,
            endTime,
            description
        );
    }

    public List<EmployeeUnavailability> findEmployeeUnavailability(Long employeeId,
                                                                   LocalDate from,
                                                                   LocalDate to) {
        return jdbcTemplate.query("""
            SELECT * FROM employee_unavailability
            WHERE employee_id = ?
              AND start_time < ?
              AND end_time > ?
            ORDER BY start_time
            """,
            (rs, rowNum) -> new EmployeeUnavailability(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTimestamp("start_time").toLocalDateTime(),
                rs.getTimestamp("end_time").toLocalDateTime(),
                rs.getString("reason")
            ),
            employeeId,
            to.plusDays(1).atStartOfDay(),
            from.atStartOfDay()
        );
    }

    public EmployeeUnavailability saveEmployeeUnavailability(
            Long employeeId,
            java.time.LocalDateTime startTime,
            java.time.LocalDateTime endTime,
            String reason) {

        return jdbcTemplate.queryForObject("""
            INSERT INTO employee_unavailability
                (employee_id, start_time, end_time, reason)
            VALUES (?, ?, ?, ?)
            RETURNING *
            """,
            (rs, rowNum) -> new EmployeeUnavailability(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTimestamp("start_time").toLocalDateTime(),
                rs.getTimestamp("end_time").toLocalDateTime(),
                rs.getString("reason")
            ),
            employeeId,
            startTime,
            endTime,
            reason
        );
    }

    public EmployeeShift saveEmployeeShift(Long employeeId,
                                           java.time.LocalTime shiftStart,
                                           java.time.LocalTime shiftEnd,
                                           String workingDays) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO employee_shift
                (employee_id, shift_start, shift_end, working_days, active)
            VALUES (?, ?, ?, ?, TRUE)
            RETURNING *
            """,
            (rs, rowNum) -> new EmployeeShift(
                rs.getLong("id"),
                rs.getLong("employee_id"),
                rs.getTime("shift_start").toLocalTime(),
                rs.getTime("shift_end").toLocalTime(),
                rs.getString("working_days"),
                rs.getBoolean("active")
            ),
            employeeId,
            shiftStart,
            shiftEnd,
            workingDays
        );
    }
}
