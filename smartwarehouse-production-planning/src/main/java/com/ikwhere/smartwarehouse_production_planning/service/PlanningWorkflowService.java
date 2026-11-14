package com.ikwhere.smartwarehouse_production_planning.service;

import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse_production_planning.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.client.OrderGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.dto.AssignmentResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.CancelPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.ConfirmPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.GeneratePlanRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.MaterialRequirementResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanDetailsResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanSummaryResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.TaskResponse;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.EmployeeResource;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.ExistingAssignment;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OperationAssignment;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OrderDemand;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OrderLine;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.PlanResult;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.SchedulingInput;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.TaskResult;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.TimeWindow;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.WorkDay;
import com.ikwhere.smartwarehouse_production_planning.exception.ApiException;
import com.ikwhere.smartwarehouse_production_planning.model.Employee;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeSkill;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeUnavailability;
import com.ikwhere.smartwarehouse_production_planning.model.MaterialRequirement;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionPlan;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionTask;
import com.ikwhere.smartwarehouse_production_planning.model.ResourceAssignment;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.EmployeeRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.MaterialRequirementRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionPlanRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionTaskRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ResourceAssignmentRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.WorkCenterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class PlanningWorkflowService {

    private static final Logger log =
            LoggerFactory.getLogger(PlanningWorkflowService.class);

    private static final String DEFAULT_ALGORITHM =
            "PRIORITY_EARLIEST_DUE_DATE";

    private final SchedulingEngine schedulingEngine;
    private final ConfigurationRepository configurationRepository;
    private final EmployeeRepository employeeRepository;
    private final WorkCenterRepository workCenterRepository;
    private final ProductionPlanRepository planRepository;
    private final ProductionTaskRepository taskRepository;
    private final ResourceAssignmentRepository assignmentRepository;
    private final MaterialRequirementRepository materialRepository;
    private final OrderGrpcClient orderGrpcClient;
    private final InventoryGrpcClient inventoryGrpcClient;
    private final TransactionTemplate transactionTemplate;

    public PlanningWorkflowService(
            SchedulingEngine schedulingEngine,
            ConfigurationRepository configurationRepository,
            EmployeeRepository employeeRepository,
            WorkCenterRepository workCenterRepository,
            ProductionPlanRepository planRepository,
            ProductionTaskRepository taskRepository,
            ResourceAssignmentRepository assignmentRepository,
            MaterialRequirementRepository materialRepository,
            OrderGrpcClient orderGrpcClient,
            InventoryGrpcClient inventoryGrpcClient,
            TransactionTemplate transactionTemplate) {
        this.schedulingEngine = schedulingEngine;
        this.configurationRepository = configurationRepository;
        this.employeeRepository = employeeRepository;
        this.workCenterRepository = workCenterRepository;
        this.planRepository = planRepository;
        this.taskRepository = taskRepository;
        this.assignmentRepository = assignmentRepository;
        this.materialRepository = materialRepository;
        this.orderGrpcClient = orderGrpcClient;
        this.inventoryGrpcClient = inventoryGrpcClient;
        this.transactionTemplate = transactionTemplate;
    }

    // ---------------------------------------------------------------------
    // Generate
    // ---------------------------------------------------------------------

    @Transactional
    public PlanSummaryResponse generatePlan(GeneratePlanRequest request) {
        if (request.planningEnd().isBefore(request.planningStart())) {
            throw ApiException.badRequest(
                    "planningEnd must not be before planningStart"
            );
        }

        String algorithm = request.algorithm() == null
                || request.algorithm().isBlank()
                ? DEFAULT_ALGORITHM
                : request.algorithm();

        List<ProductionOrderDto> orders =
                orderGrpcClient.getPendingProductionOrders(
                        request.planningStart().toString(),
                        request.planningEnd().toString()
                );

        // BOM definitions and material ids
        Map<Long, List<ProductBom>> bomsByProduct = new HashMap<>();
        Set<Long> inventoryProductIds = new LinkedHashSet<>();

        for (ProductionOrderDto order : orders) {
            for (var item : order.getItemsList()) {
                long productId = item.getProductId();
                if (!bomsByProduct.containsKey(productId)) {
                    List<ProductBom> boms =
                            configurationRepository.findBomsByProductId(productId);
                    bomsByProduct.put(productId, boms);
                }
                inventoryProductIds.add(productId);
            }
        }

        for (List<ProductBom> boms : bomsByProduct.values()) {
            for (ProductBom bom : boms) {
                inventoryProductIds.add(bom.materialProductId());
            }
        }

        Map<Long, Integer> availableInventory =
                loadInventoryAvailability(inventoryProductIds);

        // Routing per product
        Map<Long, List<RoutingOperation>> routings = new HashMap<>();
        for (Long productId : bomsByProduct.keySet()) {
            Optional<ProductionRouting> routing =
                    configurationRepository.findActiveRoutingByProductId(productId);

            if (routing.isPresent()) {
                routings.put(
                        productId,
                        configurationRepository.findOperationsByRoutingId(
                                routing.get().id()
                        )
                );
            } else {
                routings.put(productId, List.of());
            }
        }

        Map<Long, WorkCenter> workCenters = workCenterRepository.findAll()
                .stream()
                .collect(Collectors.toMap(WorkCenter::id, workCenter -> workCenter));

        List<EmployeeResource> employees = loadEmployees();

        Map<LocalDate, WorkDay> calendar = new HashMap<>();
        for (var entry : configurationRepository.findWorkingCalendar(
                request.planningStart(),
                request.planningEnd().plusDays(30))) {
            calendar.put(
                    entry.workDate(),
                    new WorkDay(
                            entry.workingDay(),
                            entry.startTime(),
                            entry.endTime()
                    )
            );
        }

        List<OrderDemand> demands = new ArrayList<>();
        for (ProductionOrderDto order : orders) {
            List<OrderLine> lines = new ArrayList<>();
            for (var item : order.getItemsList()) {
                lines.add(new OrderLine(item.getProductId(), item.getQuantity()));
            }

            demands.add(new OrderDemand(
                    order.getOrderId(),
                    order.getCustomerId(),
                    parseDueDate(order.getDueDate()),
                    order.getPriority(),
                    parseDateTime(order.getCreatedAt()),
                    lines
            ));
        }

        List<ExistingAssignment> existingAssignments =
                assignmentRepository.findCommittedAssignments()
                        .stream()
                        .map(assignment -> new ExistingAssignment(
                                assignment.workCenterId(),
                                assignment.employeeId(),
                                assignment.startTime(),
                                assignment.endTime()
                        ))
                        .toList();

        PlanResult result = schedulingEngine.generate(new SchedulingInput(
                demands,
                availableInventory,
                bomsByProduct,
                routings,
                workCenters,
                employees,
                calendar,
                existingAssignments,
                request.planningStart().atStartOfDay()
        ));

        ProductionPlan plan = planRepository.create(
                request.planningStart().atStartOfDay(),
                request.planningEnd().atTime(23, 59, 59),
                algorithm
        );

        for (TaskResult taskResult : result.tasks()) {
            LocalDateTime dueDate = taskResult.dueDate() == null
                    ? request.planningEnd().atTime(23, 59, 59)
                    : taskResult.dueDate();

            ProductionTask task = taskRepository.save(
                    plan.id(),
                    taskResult.orderId(),
                    taskResult.productId(),
                    taskResult.quantity(),
                    dueDate,
                    taskResult.startTime(),
                    taskResult.endTime(),
                    taskResult.priority(),
                    taskResult.status(),
                    truncate(taskResult.statusReason(), 1000),
                    taskResult.estimatedCompletion()
            );

            for (OperationAssignment assignment : taskResult.assignments()) {
                assignmentRepository.save(
                        task.id(),
                        assignment.operationId(),
                        assignment.workCenterId(),
                        assignment.employeeId(),
                        assignment.start(),
                        assignment.end(),
                        assignment.allocatedHours()
                );
            }

            for (var material : taskResult.materials()) {
                materialRepository.save(
                        task.id(),
                        material.materialProductId(),
                        material.requiredQuantity(),
                        material.reservedQuantity(),
                        material.status()
                );
            }
        }

        return summarise(plan, taskRepository.findByPlanId(plan.id()));
    }

    // ---------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------

    public List<PlanSummaryResponse> listPlans() {
        return planRepository.findAll().stream()
                .map(plan -> summarise(
                        plan,
                        taskRepository.findByPlanId(plan.id())
                ))
                .toList();
    }

    public PlanDetailsResponse getPlan(Long planId) {
        ProductionPlan plan = requirePlan(planId);

        List<TaskResponse> tasks = taskRepository.findByPlanId(planId)
                .stream()
                .map(this::toTaskResponse)
                .toList();

        return new PlanDetailsResponse(
                plan.id(),
                plan.planNumber(),
                plan.status(),
                plan.planningStart(),
                plan.planningEnd(),
                plan.algorithm(),
                plan.reservationReference(),
                plan.failureReason(),
                plan.createdAt(),
                tasks
        );
    }

    public List<TaskResponse> listTasks(Long planId) {
        List<ProductionTask> tasks = planId == null
                ? taskRepository.findAll()
                : taskRepository.findByPlanId(planId);

        return tasks.stream().map(this::toTaskResponse).toList();
    }

    public TaskResponse getTask(Long taskId) {
        return toTaskResponse(requireTask(taskId));
    }

    public List<AssignmentResponse> listResources(Long planId) {
        List<ResourceAssignment> assignments = planId == null
                ? assignmentRepository.findAll()
                : assignmentRepository.findByPlanId(planId);

        return assignments.stream()
                .map(this::toAssignmentResponse)
                .toList();
    }

    // ---------------------------------------------------------------------
    // Confirm / cancel
    // ---------------------------------------------------------------------

    public ConfirmPlanResponse confirmPlan(Long planId) {
        ProductionPlan plan = requirePlan(planId);

        if ("CONFIRMED".equals(plan.status())) {
            return new ConfirmPlanResponse(
                    planId,
                    "CONFIRMED",
                    "Production plan is already confirmed"
            );
        }

        if (!"DRAFT".equals(plan.status())
                && !"VALIDATED".equals(plan.status())) {
            throw ApiException.conflict(
                    "Production plan " + planId
                            + " cannot be confirmed from status " + plan.status()
            );
        }

        if (!planRepository.claimForValidation(planId)) {
            throw ApiException.conflict(
                    "Production plan " + planId
                            + " is being confirmed by another request"
            );
        }

        try {
            List<ProductionTask> tasks = taskRepository.findByPlanId(planId);

            if (tasks.isEmpty()) {
                throw ApiException.conflict(
                        "Production plan " + planId + " has no production tasks"
                );
            }

            for (ProductionTask task : tasks) {
                if ("MATERIAL_SHORTAGE".equals(task.status())
                        || "CAPACITY_SHORTAGE".equals(task.status())) {
                    throw ApiException.conflict(
                            "Task " + task.id() + " cannot be confirmed: "
                                    + task.status() + " (" + task.statusReason() + ")"
                    );
                }
            }

            List<MaterialRequirement> requirements =
                    materialRepository.findByPlanId(planId);

            for (MaterialRequirement requirement : requirements) {
                if (!"RESERVED".equals(requirement.status())) {
                    throw ApiException.conflict(
                            "Material " + requirement.materialProductId()
                                    + " is short for task "
                                    + requirement.productionTaskId()
                    );
                }
            }

            Map<Long, Integer> requiredMaterials = aggregateRequirements(
                    requirements
            );

            if (!requiredMaterials.isEmpty()) {
                Map<Long, Integer> available = loadInventoryAvailability(
                        requiredMaterials.keySet()
                );

                for (Map.Entry<Long, Integer> entry
                        : requiredMaterials.entrySet()) {
                    int onHand = available.getOrDefault(entry.getKey(), 0);
                    if (onHand < entry.getValue()) {
                        throw ApiException.conflict(
                                "Insufficient material " + entry.getKey()
                                        + ": required " + entry.getValue()
                                        + ", available " + onHand
                        );
                    }
                }

                ReserveMaterialsResponse reservation =
                        inventoryGrpcClient.reserveMaterials(
                                plan.planNumber(),
                                requiredMaterials
                        );

                if (!reservation.getSuccess()) {
                    throw ApiException.conflict(
                            "Material reservation failed: "
                                    + reservation.getMessage()
                    );
                }
            }

            try {
                transactionTemplate.executeWithoutResult(status -> {
                    planRepository.markConfirmed(planId, plan.planNumber());
                    materialRepository.markReservedByPlan(planId);
                });
            } catch (RuntimeException e) {
                // The remote reservation succeeded but the local commit did
                // not. Release the reservation and return the plan to DRAFT.
                compensateRelease(plan.planNumber(), requiredMaterials);
                planRepository.markDraft(
                        planId,
                        truncate("Confirmation failed: " + e.getMessage(), 1000)
                );
                throw e;
            }

            List<String> orderFailures = updateOrderStatuses(
                    tasks,
                    "PLANNED"
            );

            if (orderFailures.isEmpty()) {
                planRepository.clearFailure(planId);
                return new ConfirmPlanResponse(
                        planId,
                        "CONFIRMED",
                        "Production plan confirmed successfully"
                );
            }

            String failure = "Order status update failed: "
                    + String.join("; ", orderFailures);
            log.error("Plan {} confirmed but {}", planId, failure);
            planRepository.recordFailure(planId, truncate(failure, 1000));

            return new ConfirmPlanResponse(
                    planId,
                    "CONFIRMED",
                    "Production plan confirmed, but " + failure
            );

        } catch (RuntimeException e) {
            ProductionPlan current = planRepository.findById(planId)
                    .orElse(null);

            if (current != null && "VALIDATING".equals(current.status())) {
                planRepository.markDraft(planId, truncate(e.getMessage(), 1000));
            }

            throw e;
        }
    }

    public CancelPlanResponse cancelPlan(Long planId) {
        ProductionPlan plan = requirePlan(planId);

        if ("CANCELLED".equals(plan.status())) {
            return new CancelPlanResponse(
                    planId,
                    "CANCELLED",
                    "Production plan is already cancelled"
            );
        }

        if ("COMPLETED".equals(plan.status())
                || "IN_PROGRESS".equals(plan.status())) {
            throw ApiException.conflict(
                    "Production plan " + planId
                            + " cannot be cancelled from status " + plan.status()
            );
        }

        List<ProductionTask> tasks = taskRepository.findByPlanId(planId);
        boolean wasConfirmed = "CONFIRMED".equals(plan.status());

        if (wasConfirmed && plan.reservationReference() != null) {
            Map<Long, Integer> requiredMaterials = aggregateRequirements(
                    materialRepository.findByPlanId(planId)
            );

            if (!requiredMaterials.isEmpty()) {
                ReleaseMaterialsResponse release =
                        inventoryGrpcClient.releaseMaterials(
                                plan.reservationReference(),
                                requiredMaterials
                        );

                if (!release.getSuccess()) {
                    throw ApiException.conflict(
                            "Could not release materials for plan " + planId
                                    + ": " + release.getMessage()
                    );
                }
            }
        }

        transactionTemplate.executeWithoutResult(status -> {
            planRepository.updateStatus(planId, "CANCELLED");
            taskRepository.cancelByPlan(planId);

            if (wasConfirmed) {
                materialRepository.markReleasedByPlan(planId);
            }
        });

        if (wasConfirmed) {
            List<String> orderFailures = updateOrderStatuses(
                    tasks,
                    "PENDING_PRODUCTION"
            );
            if (!orderFailures.isEmpty()) {
                log.error(
                        "Plan {} cancelled but order status update failed: {}",
                        planId,
                        String.join("; ", orderFailures)
                );
            }
        }

        return new CancelPlanResponse(
                planId,
                "CANCELLED",
                "Production plan cancelled successfully"
        );
    }

    // ---------------------------------------------------------------------
    // Task lifecycle
    // ---------------------------------------------------------------------

    public TaskResponse startTask(Long taskId) {
        ProductionTask task = requireTask(taskId);
        ProductionPlan plan = requirePlan(task.planId());

        if (!"CONFIRMED".equals(plan.status())
                && !"IN_PROGRESS".equals(plan.status())) {
            throw ApiException.conflict(
                    "Plan " + plan.id() + " must be confirmed before starting tasks"
            );
        }

        if (!Set.of("SCHEDULED", "AT_RISK", "CONFIRMED")
                .contains(task.status())) {
            throw ApiException.conflict(
                    "Task " + taskId + " cannot be started from status "
                            + task.status()
            );
        }

        taskRepository.updateStatus(taskId, "IN_PROGRESS");
        planRepository.updateStatus(plan.id(), "IN_PROGRESS");

        try {
            orderGrpcClient.updateProductionStatus(
                    task.orderId(),
                    "IN_PRODUCTION"
            );
        } catch (RuntimeException e) {
            log.error(
                    "Task {} started but order {} status update failed",
                    taskId,
                    task.orderId(),
                    e
            );
        }

        return getTask(taskId);
    }

    public TaskResponse completeTask(Long taskId) {
        ProductionTask task = requireTask(taskId);

        if (!"IN_PROGRESS".equals(task.status())) {
            throw ApiException.conflict(
                    "Task " + taskId + " cannot be completed from status "
                            + task.status()
            );
        }

        taskRepository.updateStatus(taskId, "COMPLETED");

        List<ProductionTask> orderTasks =
                taskRepository.findByOrderId(task.orderId());

        boolean orderComplete = orderTasks.stream()
                .allMatch(item -> "COMPLETED".equals(item.status()));

        if (orderComplete) {
            try {
                orderGrpcClient.updateProductionStatus(
                        task.orderId(),
                        "PRODUCTION_COMPLETED"
                );
            } catch (RuntimeException e) {
                log.error(
                        "Order {} production status update failed",
                        task.orderId(),
                        e
                );
            }
        }

        int unfinished = taskRepository.countByPlanIdAndStatusNot(
                task.planId(),
                "COMPLETED"
        );

        if (unfinished == 0) {
            planRepository.updateStatus(task.planId(), "COMPLETED");
        }

        return getTask(taskId);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private ProductionPlan requirePlan(Long planId) {
        return planRepository.findById(planId)
                .orElseThrow(() -> ApiException.notFound(
                        "Production plan not found: " + planId
                ));
    }

    private ProductionTask requireTask(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound(
                        "Production task not found: " + taskId
                ));
    }

    private Map<Long, Integer> loadInventoryAvailability(
            java.util.Collection<Long> productIds) {

        Map<Long, Integer> availability = new HashMap<>();

        if (productIds == null || productIds.isEmpty()) {
            return availability;
        }

        List<InventoryResponse> responses =
                inventoryGrpcClient.getInventoryBatch(
                        List.copyOf(new LinkedHashSet<>(productIds))
                );

        for (InventoryResponse response : responses) {
            availability.put(
                    response.getProductId(),
                    response.getAvailableQuantity()
            );
        }

        return availability;
    }

    private List<EmployeeResource> loadEmployees() {
        Map<Long, Set<String>> skills = new HashMap<>();
        for (EmployeeSkill skill : configurationRepository.findAllEmployeeSkills()) {
            skills.computeIfAbsent(skill.employeeId(), key -> new LinkedHashSet<>())
                    .add(skill.skillCode());
        }

        Map<Long, List<EmployeeShift>> shifts = new HashMap<>();
        for (EmployeeShift shift
                : configurationRepository.findAllEmployeeShifts()) {
            shifts.computeIfAbsent(shift.employeeId(), key -> new ArrayList<>())
                    .add(shift);
        }

        Map<Long, List<TimeWindow>> unavailability = new HashMap<>();
        for (EmployeeUnavailability item
                : configurationRepository.findAllUnavailability()) {
            unavailability
                    .computeIfAbsent(item.employeeId(), key -> new ArrayList<>())
                    .add(new TimeWindow(item.startTime(), item.endTime()));
        }

        List<EmployeeResource> resources = new ArrayList<>();

        for (Employee employee : employeeRepository.findAll()) {
            resources.add(new EmployeeResource(
                    employee.id(),
                    skills.getOrDefault(employee.id(), Set.of()),
                    shifts.getOrDefault(employee.id(), List.of()),
                    unavailability.getOrDefault(employee.id(), List.of())
            ));
        }

        return resources;
    }

    private Map<Long, Integer> aggregateRequirements(
            List<MaterialRequirement> requirements) {

        Map<Long, Integer> totals = new TreeMap<>();

        for (MaterialRequirement requirement : requirements) {
            totals.merge(
                    requirement.materialProductId(),
                    requirement.requiredQuantity(),
                    Integer::sum
            );
        }

        return totals;
    }

    private void compensateRelease(String reference,
                                   Map<Long, Integer> materials) {
        if (materials == null || materials.isEmpty()) {
            return;
        }

        try {
            ReleaseMaterialsResponse response =
                    inventoryGrpcClient.releaseMaterials(reference, materials);

            if (!response.getSuccess()) {
                log.error(
                        "Compensation release for reservation {} failed: {}",
                        reference,
                        response.getMessage()
                );
            }
        } catch (RuntimeException e) {
            log.error(
                    "Compensation release for reservation {} failed",
                    reference,
                    e
            );
        }
    }

    private List<String> updateOrderStatuses(List<ProductionTask> tasks,
                                             String status) {
        Set<Long> orderIds = new LinkedHashSet<>();
        for (ProductionTask task : tasks) {
            orderIds.add(task.orderId());
        }

        List<String> failures = new ArrayList<>();

        for (Long orderId : orderIds) {
            try {
                var response = orderGrpcClient.updateProductionStatus(
                        orderId,
                        status
                );

                if (!response.getSuccess()) {
                    failures.add("order " + orderId + ": "
                            + response.getMessage());
                }
            } catch (RuntimeException e) {
                failures.add("order " + orderId + ": " + e.getMessage());
            }
        }

        return failures;
    }

    private PlanSummaryResponse summarise(ProductionPlan plan,
                                          List<ProductionTask> tasks) {
        Set<Long> orderIds = new LinkedHashSet<>();
        int scheduled = 0;
        int atRisk = 0;
        int materialShortage = 0;
        int capacityShortage = 0;

        for (ProductionTask task : tasks) {
            orderIds.add(task.orderId());

            if (task.endTime() != null) {
                scheduled++;
            }

            switch (task.status()) {
                case "AT_RISK" -> atRisk++;
                case "MATERIAL_SHORTAGE" -> materialShortage++;
                case "CAPACITY_SHORTAGE" -> capacityShortage++;
                default -> {
                    // no-op
                }
            }
        }

        return new PlanSummaryResponse(
                plan.id(),
                plan.planNumber(),
                plan.status(),
                plan.planningStart(),
                plan.planningEnd(),
                plan.algorithm(),
                orderIds.size(),
                scheduled,
                atRisk,
                materialShortage,
                capacityShortage,
                plan.createdAt()
        );
    }

    private TaskResponse toTaskResponse(ProductionTask task) {
        List<AssignmentResponse> assignments =
                assignmentRepository.findByTaskId(task.id())
                        .stream()
                        .map(this::toAssignmentResponse)
                        .toList();

        List<MaterialRequirementResponse> materials =
                materialRepository.findByTaskId(task.id())
                        .stream()
                        .map(this::toMaterialResponse)
                        .toList();

        return new TaskResponse(
                task.id(),
                task.planId(),
                task.orderId(),
                task.productId(),
                task.quantity(),
                task.startTime(),
                task.endTime(),
                task.dueDate(),
                task.estimatedCompletion(),
                task.priority(),
                task.status(),
                task.statusReason(),
                assignments,
                materials
        );
    }

    private AssignmentResponse toAssignmentResponse(ResourceAssignment assignment) {
        return new AssignmentResponse(
                assignment.id(),
                assignment.operationId(),
                assignment.workCenterId(),
                assignment.employeeId(),
                assignment.startTime(),
                assignment.endTime(),
                assignment.allocatedHours(),
                assignment.status()
        );
    }

    private MaterialRequirementResponse toMaterialResponse(
            MaterialRequirement requirement) {
        return new MaterialRequirementResponse(
                requirement.id(),
                requirement.materialProductId(),
                requirement.requiredQuantity(),
                requirement.reservedQuantity(),
                requirement.status()
        );
    }

    private LocalDateTime parseDueDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return LocalDate.parse(value).atTime(17, 0);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(value).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }

        return value.length() <= maxLength
                ? value
                : value.substring(0, maxLength);
    }
}
