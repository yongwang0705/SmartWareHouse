package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class WorkCenterRepository {
    private final JdbcTemplate jdbcTemplate;

    public WorkCenterRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<WorkCenter> findAll() {
        return jdbcTemplate.query(
            "SELECT * FROM work_center WHERE active = TRUE",
            (rs, rowNum) -> new WorkCenter(
                rs.getLong("id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getDouble("capacity_hours_per_day"),
                rs.getBoolean("active")
            )
        );
    }

    public WorkCenter save(WorkCenter wc) {
        String sql = "INSERT INTO work_center (code, name, capacity_hours_per_day) VALUES (?, ?, ?) RETURNING *";
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new WorkCenter(
            rs.getLong("id"),
            rs.getString("code"),
            rs.getString("name"),
            rs.getDouble("capacity_hours_per_day"),
            rs.getBoolean("active")
        ), wc.code(), wc.name(), wc.capacityHoursPerDay());
    }
}
