package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.model.Employee;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import com.ikwhere.smartwarehouse_production_planning.repository.EmployeeRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionRoutingRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.WorkCenterRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/production")
public class ProductionConfigurationController {

    private final WorkCenterRepository workCenterRepository;
    private final EmployeeRepository employeeRepository;
    private final ProductionRoutingRepository productionRoutingRepository;

    public ProductionConfigurationController(
            WorkCenterRepository workCenterRepository,
            EmployeeRepository employeeRepository,
            ProductionRoutingRepository productionRoutingRepository) {
        this.workCenterRepository = workCenterRepository;
        this.employeeRepository = employeeRepository;
        this.productionRoutingRepository = productionRoutingRepository;
    }

    // Work Centers
    @GetMapping("/work-centers")
    public ResponseEntity<List<WorkCenter>> getWorkCenters() {
        return ResponseEntity.ok(workCenterRepository.findAll());
    }

    @PostMapping("/work-centers")
    public ResponseEntity<WorkCenter> createWorkCenter(@RequestBody WorkCenter workCenter) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workCenterRepository.save(workCenter));
    }

    // Employees
    @GetMapping("/employees")
    public ResponseEntity<List<Employee>> getEmployees() {
        return ResponseEntity.ok(employeeRepository.findAll());
    }

    @PostMapping("/employees")
    public ResponseEntity<Employee> createEmployee(@RequestBody Employee employee) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeRepository.save(employee));
    }

    // Routings
    @GetMapping("/routings")
    public ResponseEntity<List<ProductionRouting>> getRoutings() {
        return ResponseEntity.ok(productionRoutingRepository.findAll());
    }

    @PostMapping("/routings")
    public ResponseEntity<ProductionRouting> createRouting(@RequestBody ProductionRouting routing) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productionRoutingRepository.save(routing));
    }
}
