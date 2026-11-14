package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.MaterialRequirement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class MaterialRequirementRepository {

    private final JdbcTemplate jdbcTemplate;

    public MaterialRequirementRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<MaterialRequirement> rowMapper = (rs, rowNum) ->
            new MaterialRequirement(
                    rs.getLong("id"),
                    rs.getLong("production_task_id"),
                    rs.getLong("material_product_id"),
                    rs.getInt("required_quantity"),
                    rs.getInt("reserved_quantity"),
                    rs.getString("status")
            );

    public MaterialRequirement save(Long taskId,
                                    Long materialProductId,
                                    Integer requiredQuantity,
                                    Integer reservedQuantity,
                                    String status) {

        return jdbcTemplate.queryForObject("""
                INSERT INTO production_material_requirement
                    (production_task_id, material_product_id,
                     required_quantity, reserved_quantity, status)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
                """,
                rowMapper,
                taskId,
                materialProductId,
                requiredQuantity,
                reservedQuantity,
                status
        );
    }

    public List<MaterialRequirement> findByTaskId(Long taskId) {
        return jdbcTemplate.query(
                "SELECT * FROM production_material_requirement WHERE production_task_id = ? ORDER BY material_product_id",
                rowMapper,
                taskId
        );
    }

    public List<MaterialRequirement> findByPlanId(Long planId) {
        return jdbcTemplate.query("""
                SELECT r.*
                FROM production_material_requirement r
                JOIN production_task t ON t.id = r.production_task_id
                WHERE t.plan_id = ?
                ORDER BY r.production_task_id, r.material_product_id
                """, rowMapper, planId);
    }

    public void markReservedByPlan(Long planId) {
        jdbcTemplate.update("""
                UPDATE production_material_requirement r
                SET reserved_quantity = r.required_quantity,
                    status = 'RESERVED'
                FROM production_task t
                WHERE t.id = r.production_task_id
                  AND t.plan_id = ?
                  AND r.status <> 'SHORTAGE'
                """, planId);
    }

    public void markReleasedByPlan(Long planId) {
        jdbcTemplate.update("""
                UPDATE production_material_requirement r
                SET reserved_quantity = 0,
                    status = 'RELEASED'
                FROM production_task t
                WHERE t.id = r.production_task_id
                  AND t.plan_id = ?
                """, planId);
    }
}
