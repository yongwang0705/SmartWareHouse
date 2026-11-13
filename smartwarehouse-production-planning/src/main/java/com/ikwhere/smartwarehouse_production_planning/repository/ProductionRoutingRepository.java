package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class ProductionRoutingRepository {
    private final JdbcTemplate jdbcTemplate;

    public ProductionRoutingRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ProductionRouting> findAll() {
        return jdbcTemplate.query(
            "SELECT * FROM production_routing WHERE active = TRUE",
            (rs, rowNum) -> new ProductionRouting(
                rs.getLong("id"),
                rs.getLong("product_id"),
                rs.getString("name"),
                rs.getBoolean("active")
            )
        );
    }

    public ProductionRouting save(ProductionRouting routing) {
        String sql = "INSERT INTO production_routing (product_id, name) VALUES (?, ?) RETURNING *";
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new ProductionRouting(
            rs.getLong("id"),
            rs.getLong("product_id"),
            rs.getString("name"),
            rs.getBoolean("active")
        ), routing.productId(), routing.name());
    }
}
