package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeSkill;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
