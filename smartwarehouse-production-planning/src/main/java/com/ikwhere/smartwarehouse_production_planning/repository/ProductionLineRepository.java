package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.dto.CreateProductionLineRequest;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionLine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class ProductionLineRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProductionLineRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ProductionLine> rowMapper = (rs, rowNum) ->
            new ProductionLine(
                    rs.getLong("id"),
                    rs.getString("code"),
                    rs.getString("name"),
                    rs.getInt("employees"),
                    rs.getInt("units_per_hour"),
                    rs.getBoolean("active")
            );

    public List<ProductionLine> findAllActive() {
        return jdbcTemplate.query(
                "SELECT * FROM production_line WHERE active = TRUE ORDER BY code",
                rowMapper
        );
    }

    public Optional<ProductionLine> findById(Long id) {
        return jdbcTemplate.query(
                "SELECT * FROM production_line WHERE id = ?",
                rowMapper,
                id
        ).stream().findFirst();
    }

    public Optional<ProductionLine> findByCode(String code) {
        return jdbcTemplate.query(
                "SELECT * FROM production_line WHERE code = ?",
                rowMapper,
                code
        ).stream().findFirst();
    }

    public ProductionLine save(CreateProductionLineRequest request) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO production_line
                    (code, name, employees, units_per_hour, active)
                VALUES (?, ?, ?, ?, TRUE)
                RETURNING *
                """,
                rowMapper,
                request.code().trim().toUpperCase(),
                request.name().trim(),
                request.employees(),
                request.unitsPerHour()
        );
    }

    public ProductionLine update(Long id,
                                 CreateProductionLineRequest request) {
        return jdbcTemplate.queryForObject("""
                UPDATE production_line
                SET name = ?,
                    employees = ?,
                    units_per_hour = ?,
                    active = TRUE
                WHERE id = ?
                RETURNING *
                """,
                rowMapper,
                request.name().trim(),
                request.employees(),
                request.unitsPerHour(),
                id
        );
    }
}
