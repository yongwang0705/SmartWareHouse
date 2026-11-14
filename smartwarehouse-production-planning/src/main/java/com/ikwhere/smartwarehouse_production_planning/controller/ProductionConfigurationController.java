package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.dto.CreateEmployeeShiftRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.CreateEmployeeSkillRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.CreateRoutingOperationRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.CreateWorkingCalendarEntryRequest;
import com.ikwhere.smartwarehouse_production_planning.model.Employee;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeSkill;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import com.ikwhere.smartwarehouse_production_planning.model.WorkingCalendarEntry;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.EmployeeRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionRoutingRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.WorkCenterRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/production")
public class ProductionConfigurationController {

    private final WorkCenterRepository workCenterRepository;
    private final EmployeeRepository employeeRepository;
    private final ProductionRoutingRepository productionRoutingRepository;
    private final ConfigurationRepository configurationRepository;

    public ProductionConfigurationController(
            WorkCenterRepository workCenterRepository,
            EmployeeRepository employeeRepository,
            ProductionRoutingRepository productionRoutingRepository,
            ConfigurationRepository configurationRepository) {
        this.workCenterRepository = workCenterRepository;
        this.employeeRepository = employeeRepository;
        this.productionRoutingRepository = productionRoutingRepository;
        this.configurationRepository = configurationRepository;
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

    @PostMapping("/employees/{employeeId}/skills")
    public ResponseEntity<EmployeeSkill> createEmployeeSkill(
            @PathVariable Long employeeId,
            @Valid @RequestBody CreateEmployeeSkillRequest request) {

        EmployeeSkill skill = configurationRepository.saveEmployeeSkill(
                employeeId,
                request.skillCode(),
                request.proficiency() == null
                        ? "INTERMEDIATE"
                        : request.proficiency()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(skill);
    }

    @PostMapping("/employees/{employeeId}/shifts")
    public ResponseEntity<EmployeeShift> createEmployeeShift(
            @PathVariable Long employeeId,
            @Valid @RequestBody CreateEmployeeShiftRequest request) {

        EmployeeShift shift = configurationRepository.saveEmployeeShift(
                employeeId,
                request.shiftStart(),
                request.shiftEnd(),
                request.workingDays() == null
                        ? "MON,TUE,WED,THU,FRI"
                        : request.workingDays()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(shift);
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

    @PostMapping("/routings/{routingId}/operations")
    public ResponseEntity<RoutingOperation> createRoutingOperation(
            @PathVariable Long routingId,
            @Valid @RequestBody CreateRoutingOperationRequest request) {

        RoutingOperation operation = configurationRepository.saveRoutingOperation(
                routingId,
                request.sequenceNumber(),
                request.operationName(),
                request.workCenterId(),
                request.skillCode(),
                request.minutesPerUnit(),
                request.setupMinutes() == null
                        ? BigDecimal.ZERO
                        : request.setupMinutes()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(operation);
    }

    // Working calendar
    @GetMapping("/working-calendar")
    public ResponseEntity<List<WorkingCalendarEntry>> getWorkingCalendar(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {

        return ResponseEntity.ok(
                configurationRepository.findWorkingCalendar(from, to)
        );
    }

    @PostMapping("/working-calendar")
    public ResponseEntity<WorkingCalendarEntry> saveWorkingCalendarEntry(
            @Valid @RequestBody CreateWorkingCalendarEntryRequest request) {

        WorkingCalendarEntry entry = configurationRepository
                .saveWorkingCalendarEntry(
                        request.workDate(),
                        request.workingDay(),
                        request.startTime(),
                        request.endTime(),
                        request.description()
                );

        return ResponseEntity.status(HttpStatus.CREATED).body(entry);
    }
}
