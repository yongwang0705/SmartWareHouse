package com.ikwhere.smartwarehouse_production_planning.service;

import com.ikwhere.smartwarehouse.grpc.AddStockResponse;
import com.ikwhere.smartwarehouse.grpc.FulfillMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse_production_planning.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.client.OrderGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.dto.AssignmentResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.CancelPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.ConfirmPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.LineAssignmentResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.GeneratePlanRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.MaterialRequirementResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanDetailsResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanSummaryResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanTaskRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.ReplenishPlanRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.TaskResponse;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.ExistingLineBooking;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.LineAssignment;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.OrderDemand;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.OrderLine;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.PlanResult;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.SchedulingInput;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.TaskResult;
import com.ikwhere.smartwarehouse_production_planning.engine.LineSchedulingEngine.WorkDay;
import com.ikwhere.smartwarehouse_production_planning.exception.ApiException;
import com.ikwhere.smartwarehouse_production_planning.model.Employee;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeSkill;
import com.ikwhere.smartwarehouse_production_planning.model.EmployeeUnavailability;
import com.ikwhere.smartwarehouse_production_planning.model.MaterialRequirement;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionPlan;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionLine;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionRouting;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionTask;
import com.ikwhere.smartwarehouse_production_planning.model.ResourceAssignment;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.EmployeeRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.LineAssignmentRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.MaterialRequirementRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionPlanRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionLineRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionTaskRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.ResourceAssignmentRepository;
import com.ikwhere.smartwarehouse_production_planning.repository.WorkCenterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
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

    private final LineSchedulingEngine lineSchedulingEngine;
    private final ConfigurationRepository configurationRepository;
    private final ProductionPlanRepository planRepository;
    private final ProductionTaskRepository taskRepository;
    private final ResourceAssignmentRepository assignmentRepository;
    private final LineAssignmentRepository lineAssignmentRepository;
    private final ProductionLineRepository productionLineRepository;
    private final MaterialRequirementRepository materialRepository;
    private final OrderGrpcClient orderGrpcClient;
    private final InventoryGrpcClient inventoryGrpcClient;
    private final TransactionTemplate transactionTemplate;

    public PlanningWorkflowService(
            LineSchedulingEngine lineSchedulingEngine,
            ConfigurationRepository configurationRepository,
            ProductionPlanRepository planRepository,
            ProductionTaskRepository taskRepository,
            ResourceAssignmentRepository assignmentRepository,
            LineAssignmentRepository lineAssignmentRepository,
            ProductionLineRepository productionLineRepository,
            MaterialRequirementRepository materialRepository,
            OrderGrpcClient orderGrpcClient,
            InventoryGrpcClient inventoryGrpcClient,
            TransactionTemplate transactionTemplate) {
        this.lineSchedulingEngine = lineSchedulingEngine;
        this.configurationRepository = configurationRepository;
        this.planRepository = planRepository;
        this.taskRepository = taskRepository;
        this.assignmentRepository = assignmentRepository;
        this.lineAssignmentRepository = lineAssignmentRepository;
        this.productionLineRepository = productionLineRepository;
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

        LocalDateTime scheduleStart = request.scheduleStart() == null
                ? request.planningStart().atStartOfDay()
                : request.scheduleStart();

        if (scheduleStart.toLocalDate().isBefore(request.planningStart())
                || scheduleStart.toLocalDate().isAfter(request.planningEnd())) {
            throw ApiException.badRequest(
                    "scheduleStart must be within the planning window"
            );
        }

        List<ProductionOrderDto> orders =
                orderGrpcClient.getPendingProductionOrders(
                        request.planningStart().toString(),
                        request.planningEnd().toString()
                );

        List<OrderDemand> demands = new ArrayList<>();
        Set<Long> productIds = new LinkedHashSet<>();

        for (ProductionOrderDto order : orders) {
            List<OrderLine> lines = new ArrayList<>();

            for (var item : order.getItemsList()) {
                lines.add(new OrderLine(
                        item.getProductId(),
                        item.getQuantity()
                ));
                productIds.add(item.getProductId());
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

        return runPlan(
                request.planningStart(),
                request.planningEnd(),
                scheduleStart,
                algorithm,
                demands,
                productIds
        );
    }

    /**
     * Produces a product up to a target level. This is the JIT replenishment
     * path: it does not need a customer order and uses a synthetic demand with
     * order id -1 so order-status updates are skipped.
     */
    @Transactional
    public PlanSummaryResponse generateReplenishmentPlan(
            ReplenishPlanRequest request) {

        if (request.planningEnd().isBefore(request.planningStart())) {
            throw ApiException.badRequest(
                    "planningEnd must not be before planningStart"
            );
        }

        LocalDateTime scheduleStart = request.scheduleStart() == null
                ? request.planningStart().atStartOfDay()
                : request.scheduleStart();

        if (scheduleStart.toLocalDate().isBefore(request.planningStart())
                || scheduleStart.toLocalDate().isAfter(request.planningEnd())) {
            throw ApiException.badRequest(
                    "scheduleStart must be within the planning window"
            );
        }

        int available = loadInventoryAvailability(
                Set.of(request.productId())
        ).getOrDefault(request.productId(), 0);

        if (request.targetQuantity() <= available) {
            throw ApiException.badRequest(
                    "Product " + request.productId() + " already has "
                            + available + " available; target is "
                            + request.targetQuantity()
            );
        }

        List<OrderDemand> demands = List.of(new OrderDemand(
                -1L,
                0L,
                request.planningEnd().atTime(23, 59, 59),
                "HIGH",
                LocalDateTime.now(),
                List.of(new OrderLine(
                        request.productId(),
                        request.targetQuantity()
                ))
        ));

        return runPlan(
                request.planningStart(),
                request.planningEnd(),
                scheduleStart,
                DEFAULT_ALGORITHM,
                demands,
                Set.of(request.productId())
        );
    }

    private PlanSummaryResponse runPlan(LocalDate planningStart,
                                        LocalDate planningEnd,
                                        LocalDateTime scheduleStart,
                                        String algorithm,
                                        List<OrderDemand> demands,
                                        Set<Long> productIds) {

        Map<Long, List<ProductBom>> bomsByProduct = new HashMap<>();
        Set<Long> inventoryProductIds = new LinkedHashSet<>();

        for (Long productId : productIds) {
            List<ProductBom> boms =
                    configurationRepository.findBomsByProductId(productId);
            bomsByProduct.put(productId, boms);
            inventoryProductIds.add(productId);

            for (ProductBom bom : boms) {
                inventoryProductIds.add(bom.materialProductId());
            }
        }

        Map<Long, Integer> availableInventory =
                loadInventoryAvailability(inventoryProductIds);

        List<ProductionLine> lines =
                productionLineRepository.findAllActive();

        Map<LocalDate, WorkDay> calendar = new HashMap<>();

        for (var entry : configurationRepository.findWorkingCalendar(
                scheduleStart.toLocalDate(),
                planningEnd.plusDays(30))) {
            calendar.put(
                    entry.workDate(),
                    new WorkDay(
                            entry.workingDay(),
                            entry.startTime(),
                            entry.endTime()
                    )
            );
        }

        List<ExistingLineBooking> existingBookings =
                lineAssignmentRepository.findCommittedBookings()
                        .stream()
                        .map(booking -> new ExistingLineBooking(
                                booking.lineId(),
                                booking.startTime(),
                                booking.endTime()
                        ))
                        .toList();

        PlanResult result = lineSchedulingEngine.generate(new SchedulingInput(
                demands,
                availableInventory,
                bomsByProduct,
                lines,
                calendar,
                existingBookings,
                scheduleStart.withNano(0)
        ));

        ProductionPlan plan = planRepository.create(
                planningStart.atStartOfDay(),
                planningEnd.atTime(23, 59, 59),
                algorithm
        );

        for (TaskResult taskResult : result.tasks()) {
            LocalDateTime dueDate = taskResult.dueDate() == null
                    ? planningEnd.atTime(23, 59, 59)
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

            for (LineAssignment assignment : taskResult.lineAssignments()) {
                lineAssignmentRepository.save(
                        task.id(),
                        assignment.lineId(),
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
    // Manual plan editing (split an order into scheduled parts)
    // ---------------------------------------------------------------------

    @Transactional
    public TaskResponse addPlanTask(Long planId, PlanTaskRequest request) {
        ProductionPlan plan = requireEditablePlan(planId);
        validateTaskTimes(request.startTime(), request.endTime());

        ProductionTask task = taskRepository.save(
                planId,
                request.orderId(),
                request.productId(),
                request.quantity(),
                request.dueDate() == null ? plan.planningEnd() : request.dueDate(),
                request.startTime(),
                request.endTime(),
                normalizePriority(request.priority()),
                "SCHEDULED",
                null,
                request.endTime()
        );

        rebuildMaterialRequirements(
                task.id(),
                request.productId(),
                request.quantity()
        );

        assignManualLine(
                task.id(),
                request.lineId(),
                request.startTime(),
                request.endTime()
        );

        return getTask(task.id());
    }

    @Transactional
    public TaskResponse updatePlanTask(Long planId,
                                       Long taskId,
                                       PlanTaskRequest request) {
        requireEditablePlan(planId);

        ProductionTask task = requireTask(taskId);

        if (!planId.equals(task.planId())) {
            throw ApiException.notFound(
                    "Task " + taskId + " does not belong to plan " + planId
            );
        }

        if ("COMPLETED".equals(task.status())
                || "CANCELLED".equals(task.status())) {
            throw ApiException.conflict(
                    "Task " + taskId + " cannot be edited from status "
                            + task.status()
            );
        }

        validateTaskTimes(request.startTime(), request.endTime());

        ProductionPlan plan = requirePlan(planId);

        taskRepository.updatePlanTask(
                taskId,
                request.orderId(),
                request.productId(),
                request.quantity(),
                request.dueDate() == null ? plan.planningEnd() : request.dueDate(),
                request.startTime(),
                request.endTime(),
                normalizePriority(request.priority()),
                "SCHEDULED",
                request.endTime()
        );

        // Manual time changes invalidate the auto-generated resource
        // assignments; the timeline is driven by the task's own times.
        assignmentRepository.deleteByTaskId(taskId);
        assignManualLine(
                taskId,
                request.lineId(),
                request.startTime(),
                request.endTime()
        );

        rebuildMaterialRequirements(
                taskId,
                request.productId(),
                request.quantity()
        );

        return getTask(taskId);
    }

    @Transactional
    public void deletePlanTask(Long planId, Long taskId) {
        requireEditablePlan(planId);

        ProductionTask task = requireTask(taskId);

        if (!planId.equals(task.planId())) {
            throw ApiException.notFound(
                    "Task " + taskId + " does not belong to plan " + planId
            );
        }

        taskRepository.deleteById(taskId);
    }

    private ProductionPlan requireEditablePlan(Long planId) {
        ProductionPlan plan = requirePlan(planId);

        if (!"DRAFT".equals(plan.status())
                && !"VALIDATED".equals(plan.status())) {
            throw ApiException.conflict(
                    "Plan " + planId + " can only be edited while DRAFT or VALIDATED"
            );
        }

        return plan;
    }

    /**
     * An order may be split across several plans, so production is complete
     * once the quantity of COMPLETED tasks covers every ordered line.
     * Cancelled tasks and tasks from other partial plans do not block this.
     */
    private boolean isOrderProducedInFull(Long orderId,
                                          List<ProductionTask> tasks) {
        Map<Long, Integer> completed = new HashMap<>();
        for (ProductionTask task : tasks) {
            if ("COMPLETED".equals(task.status())) {
                completed.merge(
                        task.productId(),
                        task.quantity(),
                        Integer::sum
                );
            }
        }

        try {
            var requirements =
                    orderGrpcClient.getOrderRequirements(orderId);

            if (requirements.getFound()
                    && requirements.getItemsCount() > 0) {
                for (var item : requirements.getItemsList()) {
                    if (completed.getOrDefault(item.getProductId(), 0)
                            < item.getQuantity()) {
                        return false;
                    }
                }
                return true;
            }
        } catch (RuntimeException e) {
            log.warn(
                    "Could not read requirements for order {}; "
                            + "falling back to task status",
                    orderId,
                    e
            );
        }

        // Compatibility fallback for an older order service: ignore
        // cancelled tasks when checking whether all remaining work is done.
        List<ProductionTask> active = tasks.stream()
                .filter(task -> !"CANCELLED".equals(task.status()))
                .toList();

        return !active.isEmpty()
                && active.stream()
                .allMatch(task -> "COMPLETED".equals(task.status()));
    }

    private void validateTaskTimes(LocalDateTime start,
                                    LocalDateTime end) {
        if (start == null || end == null || !end.isAfter(start)) {
            throw ApiException.badRequest(
                    "endTime must be after startTime"
            );
        }
    }

    private void assignManualLine(Long taskId,
                                  Long lineId,
                                  LocalDateTime start,
                                  LocalDateTime end) {
        lineAssignmentRepository.deleteByTaskId(taskId);

        if (lineId == null) {
            return;
        }

        productionLineRepository.findById(lineId)
                .filter(line -> Boolean.TRUE.equals(line.active()))
                .orElseThrow(() -> ApiException.notFound(
                        "Production line not found: " + lineId
                ));

        long minutes = Math.max(
                0,
                Duration.between(start, end).toMinutes()
        );

        BigDecimal hours = BigDecimal.valueOf(minutes)
                .divide(
                        BigDecimal.valueOf(60),
                        2,
                        RoundingMode.HALF_UP
                );

        lineAssignmentRepository.save(
                taskId,
                lineId,
                start,
                end,
                hours
        );
    }

    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "NORMAL";
        }

        String value = priority.trim().toUpperCase();
        return Set.of("HIGH", "NORMAL", "LOW").contains(value)
                ? value
                : "NORMAL";
    }

    private void rebuildMaterialRequirements(Long taskId,
                                             Long productId,
                                             int quantity) {
        materialRepository.deleteByTaskId(taskId);

        List<ProductBom> boms =
                configurationRepository.findBomsByProductId(productId);

        if (boms.isEmpty()) {
            return;
        }

        Set<Long> materialIds = boms.stream()
                .map(ProductBom::materialProductId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<Long, Integer> available =
                loadInventoryAvailability(materialIds);

        for (ProductBom bom : boms) {
            int required = bom.quantityPerUnit() * quantity;
            int availableQuantity = Math.max(
                    0,
                    available.getOrDefault(bom.materialProductId(), 0)
            );
            int reserved = Math.min(required, availableQuantity);
            String status = reserved >= required ? "RESERVED" : "SHORTAGE";

            materialRepository.save(
                    taskId,
                    bom.materialProductId(),
                    required,
                    reserved,
                    status
            );
        }
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

        if (task.orderId() != null && task.orderId() > 0) {
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

        ProductionPlan plan = requirePlan(task.planId());
        boolean lastTask = taskRepository.countByPlanIdAndStatusNot(
                task.planId(),
                "COMPLETED"
        ) == 1;

        // Production output becomes available finished-goods inventory.
        AddStockResponse receipt =
                inventoryGrpcClient.addStock(task.productId(), task.quantity());

        if (!receipt.getSuccess()) {
            throw ApiException.badGateway(
                    "Could not add finished goods to inventory: "
                            + receipt.getMessage()
            );
        }

        // When the whole plan completes, consume the reserved BOM materials.
        if (lastTask && plan.reservationReference() != null) {
            Map<Long, Integer> requiredMaterials = aggregateRequirements(
                    materialRepository.findByPlanId(task.planId())
            );

            if (!requiredMaterials.isEmpty()) {
                FulfillMaterialsResponse consumption =
                        inventoryGrpcClient.fulfillMaterials(
                                plan.reservationReference(),
                                requiredMaterials
                        );

                if (!consumption.getSuccess()) {
                    throw ApiException.badGateway(
                            "Could not consume BOM materials: "
                                    + consumption.getMessage()
                    );
                }

                materialRepository.markConsumedByPlan(task.planId());
            }
        }

        taskRepository.markCompleted(taskId);

        if (task.orderId() != null && task.orderId() > 0) {
            List<ProductionTask> orderTasks =
                    taskRepository.findByOrderId(task.orderId());

            if (isOrderProducedInFull(task.orderId(), orderTasks)) {
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
            if (task.orderId() != null && task.orderId() > 0) {
                orderIds.add(task.orderId());
            }
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

        List<LineAssignmentResponse> lineAssignments =
                lineAssignmentRepository.findByTaskId(task.id());

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
                task.completedAt(),
                task.priority(),
                task.status(),
                task.statusReason(),
                assignments,
                lineAssignments,
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
