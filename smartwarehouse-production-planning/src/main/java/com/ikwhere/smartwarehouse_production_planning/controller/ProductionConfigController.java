package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.dto.CreateBomRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.CreateEmployeeUnavailabilityRequest;
import com.ikwhere.smartwarehouse_production_planning.exception.ApiException;
import com.ikwhere.smartwarehouse_production_planning.model.*;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    @PostMapping("/bom")
    public ResponseEntity<ProductBom> createBom(
            @Valid @RequestBody CreateBomRequest request) {

        ProductBom bom = configRepository.saveBom(
                request.productId(),
                request.materialProductId(),
                request.quantityPerUnit()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(bom);
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

    @GetMapping("/employees/{employeeId}/unavailability")
    public ResponseEntity<List<EmployeeUnavailability>> getEmployeeUnavailability(
            @PathVariable Long employeeId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {

        LocalDate start = from == null ? LocalDate.now().minusDays(30) : from;
        LocalDate end = to == null ? LocalDate.now().plusDays(90) : to;

        return ResponseEntity.ok(
                configRepository.findEmployeeUnavailability(
                        employeeId,
                        start,
                        end
                )
        );
    }

    @PostMapping("/employees/{employeeId}/unavailability")
    public ResponseEntity<EmployeeUnavailability> createEmployeeUnavailability(
            @PathVariable Long employeeId,
            @Valid @RequestBody CreateEmployeeUnavailabilityRequest request) {

        if (!request.endTime().isAfter(request.startTime())) {
            throw ApiException.badRequest(
                    "endTime must be after startTime"
            );
        }

        EmployeeUnavailability unavailability =
                configRepository.saveEmployeeUnavailability(
                        employeeId,
                        request.startTime(),
                        request.endTime(),
                        request.reason()
                );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(unavailability);
    }
}
