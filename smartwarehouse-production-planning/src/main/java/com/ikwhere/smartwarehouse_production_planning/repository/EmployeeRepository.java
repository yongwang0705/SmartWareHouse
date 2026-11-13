package com.ikwhere.smartwarehouse_production_planning.repository;

import com.ikwhere.smartwarehouse_production_planning.model.Employee;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class EmployeeRepository {
    private final JdbcTemplate jdbcTemplate;

    public EmployeeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Employee> findAll() {
        return jdbcTemplate.query(
            "SELECT * FROM employee WHERE active = TRUE",
            (rs, rowNum) -> new Employee(
                rs.getLong("id"),
                rs.getString("employee_number"),
                rs.getString("name"),
                rs.getBoolean("active")
            )
        );
    }

    public Employee save(Employee e) {
        String sql = "INSERT INTO employee (employee_number, name) VALUES (?, ?) RETURNING *";
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new Employee(
            rs.getLong("id"),
            rs.getString("employee_number"),
            rs.getString("name"),
            rs.getBoolean("active")
        ), e.employeeNumber(), e.name());
    }
}
