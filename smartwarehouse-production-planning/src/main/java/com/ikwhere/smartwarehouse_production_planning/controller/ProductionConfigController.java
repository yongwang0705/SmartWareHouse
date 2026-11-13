package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.model.*;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/production")
public class ProductionConfigController {

    private final ConfigurationRepository configRepository;

    public ProductionConfigController(ConfigurationRepository configRepository) {
        this.configRepository = configRepository;
    }

    @GetMapping("/bom/{productId}")
    public ResponseEntity<List<ProductBom>> getBom(@PathVariable Long productId) {
        return ResponseEntity.ok(configRepository.findBomsByProductId(productId));
    }

    @GetMapping("/routings/{routingId}/operations")
    public ResponseEntity<List<RoutingOperation>> getRoutingOperations(@PathVariable Long routingId) {
        return ResponseEntity.ok(configRepository.findOperationsByRoutingId(routingId));
    }

    @GetMapping("/employees/{employeeId}/skills")
    public ResponseEntity<List<EmployeeSkill>> getEmployeeSkills(@PathVariable Long employeeId) {
        return ResponseEntity.ok(configRepository.findEmployeeSkills(employeeId));
    }

    @GetMapping("/employees/{employeeId}/shifts")
    public ResponseEntity<List<EmployeeShift>> getEmployeeShifts(@PathVariable Long employeeId) {
        return ResponseEntity.ok(configRepository.findEmployeeShifts(employeeId));
    }
}
