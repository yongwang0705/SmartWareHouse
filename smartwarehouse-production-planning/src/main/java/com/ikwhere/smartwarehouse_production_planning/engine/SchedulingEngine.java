package com.ikwhere.smartwarehouse_production_planning.engine;

import com.ikwhere.smartwarehouse_production_planning.model.EmployeeShift;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Deterministic rule-based production scheduler.
 *
 * <p>The engine is intentionally free of database and gRPC dependencies so it
 * can be unit tested. The planning workflow is responsible for loading the
 * input data and persisting the result.</p>
 */
@Component
public class SchedulingEngine {

    public static final LocalTime DEFAULT_WORK_START = LocalTime.of(8, 0);
    public static final LocalTime DEFAULT_WORK_END = LocalTime.of(17, 0);
    private static final int HORIZON_DAYS = 90;

    // ---------------------------------------------------------------------
    // Input types
    // ---------------------------------------------------------------------

    public record OrderLine(Long productId, int quantity) {
    }

    public record OrderDemand(
            Long orderId,
            Long customerId,
            LocalDateTime dueDate,
            String priority,
            LocalDateTime createdAt,
            List<OrderLine> items
    ) {
    }

    public record TimeWindow(LocalDateTime start, LocalDateTime end) {
        public boolean overlaps(TimeWindow other) {
            return start.isBefore(other.end) && other.start.isBefore(end);
        }
    }

    public record EmployeeResource(
            Long id,
            Set<String> skills,
            List<EmployeeShift> shifts,
            List<TimeWindow> unavailability
    ) {
    }

    public record WorkDay(boolean working, LocalTime start, LocalTime end) {
    }

    /**
     * Resource time already committed by confirmed or in-progress plans. New
     * plans must schedule around these intervals.
     */
    public record ExistingAssignment(
            Long workCenterId,
            Long employeeId,
            LocalDateTime start,
            LocalDateTime end
    ) {
    }

    public record SchedulingInput(
            List<OrderDemand> orders,
            Map<Long, Integer> availableInventory,
            Map<Long, List<ProductBom>> boms,
            Map<Long, List<RoutingOperation>> routings,
            Map<Long, WorkCenter> workCenters,
            List<EmployeeResource> employees,
            Map<LocalDate, WorkDay> calendar,
            List<ExistingAssignment> existingAssignments,
            LocalDateTime planningStart
    ) {
    }

    // ---------------------------------------------------------------------
    // Output types
    // ---------------------------------------------------------------------

    public record OperationAssignment(
            Long operationId,
            int sequenceNumber,
            String operationName,
            Long workCenterId,
            Long employeeId,
            LocalDateTime start,
            LocalDateTime end,
            BigDecimal allocatedHours
    ) {
    }

    public record MaterialRequirementResult(
            Long materialProductId,
            int requiredQuantity,
            int reservedQuantity,
            String status,
            String message
    ) {
    }

    public record TaskResult(
            Long orderId,
            Long productId,
            int quantity,
            LocalDateTime dueDate,
            String priority,
            String status,
            String statusReason,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime estimatedCompletion,
            List<OperationAssignment> assignments,
            List<MaterialRequirementResult> materials
    ) {
    }

    public record PlanResult(
            List<TaskResult> tasks,
            int totalOrders,
            int scheduledOrders,
            int atRiskOrders,
            int materialShortageOrders,
            int capacityShortageOrders
    ) {
    }

    // ---------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------

    public List<OrderDemand> sortOrders(Collection<OrderDemand> orders) {
        Comparator<OrderDemand> comparator = Comparator
                .comparingInt((OrderDemand order) -> priorityWeight(order.priority()))
                .thenComparing(order -> order.dueDate() == null
                        ? LocalDateTime.MAX
                        : order.dueDate())
                .thenComparing(order -> order.createdAt() == null
                        ? LocalDateTime.MAX
                        : order.createdAt())
                .thenComparing(OrderDemand::orderId,
                        Comparator.nullsLast(Long::compareTo));

        return orders.stream().sorted(comparator).toList();
    }

    public int calculateProductionQuantity(int orderQuantity,
                                           int availableFinishedGoods) {
        return Math.max(0, orderQuantity - Math.max(0, availableFinishedGoods));
    }

    public BigDecimal calculateOperationMinutes(RoutingOperation operation,
                                                int productionQuantity) {
        return operation.setupMinutes()
                .add(operation.minutesPerUnit()
                        .multiply(BigDecimal.valueOf(productionQuantity)));
    }

    public boolean validateMaterials(List<ProductBom> boms,
                                     int productionQuantity,
                                     Map<Long, Integer> availableMaterials) {
        for (ProductBom bom : boms) {
            int required = bom.quantityPerUnit() * productionQuantity;
            int available = availableMaterials.getOrDefault(
                    bom.materialProductId(),
                    0
            );

            if (available < required) {
                return false;
            }
        }

        return true;
    }

    public PlanResult generate(SchedulingInput input) {
        Map<Long, Integer> inventory = new HashMap<>(input.availableInventory());

        List<EmployeeResource> employees = input.employees() == null
                ? List.of()
                : input.employees().stream()
                        .sorted(Comparator.comparing(EmployeeResource::id))
                        .toList();

        Map<Long, List<TimeWindow>> employeeBusy = new HashMap<>();
        for (EmployeeResource employee : employees) {
            List<TimeWindow> busy = new ArrayList<>();
            if (employee.unavailability() != null) {
                busy.addAll(employee.unavailability());
            }
            employeeBusy.put(employee.id(), busy);
        }

        Map<Long, Map<LocalDate, Long>> workCenterUsage = new HashMap<>();

        if (input.existingAssignments() != null) {
            for (ExistingAssignment assignment : input.existingAssignments()) {
                if (assignment.employeeId() != null) {
                    employeeBusy
                            .computeIfAbsent(
                                    assignment.employeeId(),
                                    key -> new ArrayList<>()
                            )
                            .add(new TimeWindow(
                                    assignment.start(),
                                    assignment.end()
                            ));
                }

                if (assignment.workCenterId() != null) {
                    long minutes = Math.max(
                            0,
                            Duration.between(
                                    assignment.start(),
                                    assignment.end()
                            ).toMinutes()
                    );

                    workCenterUsage
                            .computeIfAbsent(
                                    assignment.workCenterId(),
                                    key -> new HashMap<>()
                            )
                            .merge(
                                    assignment.start().toLocalDate(),
                                    minutes,
                                    Long::sum
                            );
                }
            }
        }

        LocalDateTime planningStart = input.planningStart() == null
                ? LocalDateTime.now().withNano(0)
                : input.planningStart().withNano(0);

        List<TaskResult> tasks = new ArrayList<>();

        for (OrderDemand order : sortOrders(input.orders())) {
            List<OrderLine> lines = order.items() == null
                    ? List.of()
                    : order.items().stream()
                            .sorted(Comparator.comparing(OrderLine::productId))
                            .toList();

            for (OrderLine line : lines) {
                int orderedQuantity = Math.max(0, line.quantity());
                if (orderedQuantity == 0) {
                    continue;
                }

                int availableFinishedGoods =
                        inventory.getOrDefault(line.productId(), 0);

                int allocatedFinishedGoods = Math.min(
                        availableFinishedGoods,
                        orderedQuantity
                );

                inventory.put(
                        line.productId(),
                        availableFinishedGoods - allocatedFinishedGoods
                );

                int productionQuantity = calculateProductionQuantity(
                        orderedQuantity,
                        allocatedFinishedGoods
                );

                if (productionQuantity <= 0) {
                    // Finished goods cover the complete demand; nothing to produce.
                    continue;
                }

                MaterialEvaluation materials = evaluateMaterials(
                        line.productId(),
                        productionQuantity,
                        input.boms(),
                        inventory
                );

                ScheduleResult schedule = scheduleTask(
                        line.productId(),
                        productionQuantity,
                        planningStart,
                        input.routings(),
                        input.workCenters(),
                        input.calendar(),
                        employees,
                        employeeBusy,
                        workCenterUsage
                );

                String status;
                String statusReason;

                if (schedule.endTime() == null) {
                    status = "CAPACITY_SHORTAGE";
                    statusReason = joinReasons(
                            schedule.issues(),
                            materials.shortages()
                    );
                } else if (!materials.shortages().isEmpty()) {
                    status = "MATERIAL_SHORTAGE";
                    statusReason = String.join("; ", materials.shortages());
                } else if (order.dueDate() != null
                        && schedule.endTime().isAfter(order.dueDate())) {
                    status = "AT_RISK";
                    statusReason = "Estimated completion "
                            + schedule.endTime()
                            + " is after due date "
                            + order.dueDate();
                } else {
                    status = "SCHEDULED";
                    statusReason = null;
                }

                tasks.add(new TaskResult(
                        order.orderId(),
                        line.productId(),
                        productionQuantity,
                        order.dueDate(),
                        normalizePriority(order.priority()),
                        status,
                        statusReason,
                        schedule.startTime(),
                        schedule.endTime(),
                        schedule.endTime(),
                        schedule.assignments(),
                        materials.requirements()
                ));
            }
        }

        Set<Long> orderIds = new LinkedHashSet<>();
        for (OrderDemand order : input.orders()) {
            orderIds.add(order.orderId());
        }

        int scheduled = 0;
        int atRisk = 0;
        int materialShortage = 0;
        int capacityShortage = 0;

        for (TaskResult task : tasks) {
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

        return new PlanResult(
                tasks,
                orderIds.size(),
                scheduled,
                atRisk,
                materialShortage,
                capacityShortage
        );
    }

    // ---------------------------------------------------------------------
    // Scheduling internals
    // ---------------------------------------------------------------------

    private record Chunk(LocalDateTime start, LocalDateTime end) {
    }

    private record Candidate(Long employeeId, List<Chunk> chunks) {
        LocalDateTime start() {
            return chunks.isEmpty() ? null : chunks.get(0).start();
        }

        LocalDateTime end() {
            return chunks.isEmpty()
                    ? null
                    : chunks.get(chunks.size() - 1).end();
        }
    }

    private record MaterialEvaluation(
            List<MaterialRequirementResult> requirements,
            List<String> shortages
    ) {
    }

    private record ScheduleResult(
            LocalDateTime startTime,
            LocalDateTime endTime,
            List<OperationAssignment> assignments,
            List<String> issues
    ) {
    }

    private MaterialEvaluation evaluateMaterials(
            Long productId,
            int productionQuantity,
            Map<Long, List<ProductBom>> boms,
            Map<Long, Integer> inventory) {

        List<ProductBom> productBoms = boms == null
                ? List.of()
                : boms.getOrDefault(productId, List.of()).stream()
                        .sorted(Comparator.comparing(ProductBom::materialProductId))
                        .toList();

        List<MaterialRequirementResult> requirements = new ArrayList<>();
        List<String> shortages = new ArrayList<>();

        for (ProductBom bom : productBoms) {
            int required = bom.quantityPerUnit() * productionQuantity;
            int available = inventory.getOrDefault(bom.materialProductId(), 0);
            int reserved = Math.min(available, required);

            inventory.put(bom.materialProductId(), available - reserved);

            if (reserved >= required) {
                requirements.add(new MaterialRequirementResult(
                        bom.materialProductId(),
                        required,
                        reserved,
                        "RESERVED",
                        null
                ));
            } else {
                int missing = required - reserved;
                String message = "Missing " + missing
                        + " unit(s) of material " + bom.materialProductId()
                        + " for product " + productId;
                shortages.add(message);
                requirements.add(new MaterialRequirementResult(
                        bom.materialProductId(),
                        required,
                        reserved,
                        "SHORTAGE",
                        message
                ));
            }
        }

        return new MaterialEvaluation(requirements, shortages);
    }

    private ScheduleResult scheduleTask(
            Long productId,
            int productionQuantity,
            LocalDateTime planningStart,
            Map<Long, List<RoutingOperation>> routings,
            Map<Long, WorkCenter> workCenters,
            Map<LocalDate, WorkDay> calendar,
            List<EmployeeResource> employees,
            Map<Long, List<TimeWindow>> employeeBusy,
            Map<Long, Map<LocalDate, Long>> workCenterUsage) {

        List<RoutingOperation> operations = routings == null
                ? List.of()
                : routings.getOrDefault(productId, List.of()).stream()
                        .sorted(Comparator.comparing(RoutingOperation::sequenceNumber))
                        .toList();

        if (operations.isEmpty()) {
            return new ScheduleResult(
                    null,
                    null,
                    List.of(),
                    List.of("No active routing defined for product " + productId)
            );
        }

        List<OperationAssignment> assignments = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        LocalDateTime cursor = planningStart;
        LocalDateTime taskStart = null;
        LocalDateTime taskEnd = null;

        for (RoutingOperation operation : operations) {
            WorkCenter workCenter = workCenters == null
                    ? null
                    : workCenters.get(operation.workCenterId());

            if (workCenter == null
                    || !workCenter.active()
                    || workCenter.capacityHoursPerDay() == null
                    || workCenter.capacityHoursPerDay() <= 0) {
                issues.add("Work center " + operation.workCenterId()
                        + " is unavailable for operation '"
                        + operation.operationName() + "'");
                break;
            }

            List<EmployeeResource> qualified = employees.stream()
                    .filter(employee -> employee.skills() != null
                            && employee.skills().contains(operation.skillCode()))
                    .toList();

            if (qualified.isEmpty()) {
                issues.add("No employee has skill '" + operation.skillCode()
                        + "' required by operation '"
                        + operation.operationName() + "'");
                break;
            }

            long requiredMinutes = operationMinutes(
                    operation,
                    productionQuantity
            );

            Candidate best = null;

            for (EmployeeResource employee : qualified) {
                Candidate candidate = simulate(
                        employee,
                        requiredMinutes,
                        cursor,
                        workCenter,
                        calendar,
                        employeeBusy,
                        workCenterUsage
                );

                if (candidate == null) {
                    continue;
                }

                if (best == null
                        || candidate.start().isBefore(best.start())
                        || (candidate.start().equals(best.start())
                        && employee.id() < best.employeeId())) {
                    best = candidate;
                }
            }

            if (best == null) {
                issues.add("No available work center/employee capacity for operation '"
                        + operation.operationName() + "'");
                break;
            }

            for (Chunk chunk : best.chunks()) {
                employeeBusy.get(best.employeeId())
                        .add(new TimeWindow(chunk.start(), chunk.end()));

                long chunkMinutes = Duration.between(
                        chunk.start(),
                        chunk.end()
                ).toMinutes();

                workCenterUsage
                        .computeIfAbsent(
                                operation.workCenterId(),
                                key -> new HashMap<>()
                        )
                        .merge(
                                chunk.start().toLocalDate(),
                                chunkMinutes,
                                Long::sum
                        );

                assignments.add(new OperationAssignment(
                        operation.id(),
                        operation.sequenceNumber(),
                        operation.operationName(),
                        operation.workCenterId(),
                        best.employeeId(),
                        chunk.start(),
                        chunk.end(),
                        BigDecimal.valueOf(chunkMinutes)
                                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP)
                ));
            }

            if (taskStart == null) {
                taskStart = best.start();
            }
            taskEnd = best.end();
            cursor = best.end();
        }

        return new ScheduleResult(taskStart, taskEnd, assignments, issues);
    }

    private Candidate simulate(
            EmployeeResource employee,
            long requiredMinutes,
            LocalDateTime earliest,
            WorkCenter workCenter,
            Map<LocalDate, WorkDay> calendar,
            Map<Long, List<TimeWindow>> employeeBusy,
            Map<Long, Map<LocalDate, Long>> workCenterUsage) {

        if (requiredMinutes <= 0) {
            return new Candidate(
                    employee.id(),
                    List.of(new Chunk(earliest, earliest))
            );
        }

        long capacityMinutes = Math.round(
                workCenter.capacityHoursPerDay() * 60
        );
        long remaining = requiredMinutes;

        List<Chunk> chunks = new ArrayList<>();
        LocalDate date = earliest.toLocalDate();
        LocalDate lastDay = date.plusDays(HORIZON_DAYS);

        while (remaining > 0 && !date.isAfter(lastDay)) {
            WorkDay workDay = resolveWorkDay(calendar, date);

            if (workDay.working()) {
                LocalTime dayStartTime = workDay.start() == null
                        ? DEFAULT_WORK_START
                        : workDay.start();
                LocalTime dayEndTime = workDay.end() == null
                        ? DEFAULT_WORK_END
                        : workDay.end();

                LocalDateTime plantStart = date.atTime(dayStartTime);
                LocalDateTime plantEnd = date.atTime(dayEndTime);

                long usedMinutes = workCenterUsage
                        .getOrDefault(workCenter.id(), Map.of())
                        .getOrDefault(date, 0L);

                long centerRemaining = Math.max(
                        0,
                        capacityMinutes - usedMinutes
                );

                if (centerRemaining > 0 && plantStart.isBefore(plantEnd)) {
                    List<TimeWindow> windows = employeeWindows(
                            employee,
                            date,
                            plantStart,
                            plantEnd
                    );

                    for (TimeWindow window : windows) {
                        LocalDateTime from = later(
                                window.start(),
                                plantStart,
                                earliest
                        );
                        LocalDateTime to = earlier(window.end(), plantEnd);

                        if (!from.isBefore(to)) {
                            continue;
                        }

                        for (TimeWindow gap : freeGaps(
                                employeeBusy.get(employee.id()),
                                from,
                                to
                        )) {
                            long gapMinutes = Duration.between(
                                    gap.start(),
                                    gap.end()
                            ).toMinutes();

                            long allocation = Math.min(
                                    remaining,
                                    Math.min(centerRemaining, gapMinutes)
                            );

                            if (allocation <= 0) {
                                continue;
                            }

                            chunks.add(new Chunk(
                                    gap.start(),
                                    gap.start().plusMinutes(allocation)
                            ));

                            remaining -= allocation;
                            centerRemaining -= allocation;

                            if (remaining <= 0) {
                                break;
                            }
                        }

                        if (remaining <= 0) {
                            break;
                        }
                    }
                }
            }

            date = date.plusDays(1);
        }

        return remaining <= 0
                ? new Candidate(employee.id(), chunks)
                : null;
    }

    private List<TimeWindow> employeeWindows(
            EmployeeResource employee,
            LocalDate date,
            LocalDateTime plantStart,
            LocalDateTime plantEnd) {

        List<EmployeeShift> shifts = employee.shifts();

        if (shifts == null || shifts.isEmpty()) {
            return List.of(new TimeWindow(plantStart, plantEnd));
        }

        DayOfWeek dayOfWeek = date.getDayOfWeek();
        List<TimeWindow> windows = new ArrayList<>();

        for (EmployeeShift shift : shifts) {
            if (!shift.active() || !worksOn(shift.workingDays(), dayOfWeek)) {
                continue;
            }

            LocalDateTime start = date.atTime(shift.shiftStart());
            LocalDateTime end = date.atTime(shift.shiftEnd());

            start = later(start, plantStart, LocalDateTime.MIN);
            end = earlier(end, plantEnd);

            if (start.isBefore(end)) {
                windows.add(new TimeWindow(start, end));
            }
        }

        return mergeWindows(windows);
    }

    private List<TimeWindow> mergeWindows(List<TimeWindow> windows) {
        if (windows.size() <= 1) {
            return windows;
        }

        List<TimeWindow> sorted = windows.stream()
                .sorted(Comparator.comparing(TimeWindow::start))
                .toList();

        List<TimeWindow> merged = new ArrayList<>();
        LocalDateTime start = sorted.get(0).start();
        LocalDateTime end = sorted.get(0).end();

        for (int i = 1; i < sorted.size(); i++) {
            TimeWindow window = sorted.get(i);

            if (!window.start().isAfter(end)) {
                end = window.end().isAfter(end) ? window.end() : end;
            } else {
                merged.add(new TimeWindow(start, end));
                start = window.start();
                end = window.end();
            }
        }

        merged.add(new TimeWindow(start, end));
        return merged;
    }

    private List<TimeWindow> freeGaps(List<TimeWindow> busy,
                                      LocalDateTime from,
                                      LocalDateTime to) {
        List<TimeWindow> gaps = new ArrayList<>();

        if (busy == null || busy.isEmpty()) {
            gaps.add(new TimeWindow(from, to));
            return gaps;
        }

        List<TimeWindow> sorted = busy.stream()
                .sorted(Comparator.comparing(TimeWindow::start))
                .toList();

        LocalDateTime cursor = from;

        for (TimeWindow window : sorted) {
            if (!window.end().isAfter(cursor)) {
                continue;
            }

            if (!window.start().isBefore(to)) {
                break;
            }

            if (window.start().isAfter(cursor)) {
                gaps.add(new TimeWindow(
                        cursor,
                        earlier(window.start(), to)
                ));
            }

            if (window.end().isAfter(cursor)) {
                cursor = window.end();
            }

            if (!cursor.isBefore(to)) {
                break;
            }
        }

        if (cursor.isBefore(to)) {
            gaps.add(new TimeWindow(cursor, to));
        }

        return gaps;
    }

    private WorkDay resolveWorkDay(Map<LocalDate, WorkDay> calendar,
                                   LocalDate date) {
        if (calendar != null && calendar.containsKey(date)) {
            return calendar.get(date);
        }

        DayOfWeek dayOfWeek = date.getDayOfWeek();

        if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
            return new WorkDay(false, null, null);
        }

        return new WorkDay(true, DEFAULT_WORK_START, DEFAULT_WORK_END);
    }

    private boolean worksOn(String workingDays, DayOfWeek dayOfWeek) {
        if (workingDays == null || workingDays.isBlank()) {
            return true;
        }

        String shortName = dayOfWeek.name().substring(0, 3);

        for (String token : workingDays.split(",")) {
            String value = token.trim().toUpperCase();
            if (value.equals(shortName) || value.equals(dayOfWeek.name())) {
                return true;
            }
        }

        return false;
    }

    private long operationMinutes(RoutingOperation operation,
                                  int productionQuantity) {
        BigDecimal minutes = calculateOperationMinutes(
                operation,
                productionQuantity
        );

        if (minutes.signum() <= 0) {
            return 0;
        }

        return minutes.setScale(0, RoundingMode.CEILING).longValueExact();
    }

    private int priorityWeight(String priority) {
        if (priority == null) {
            return 2;
        }

        return switch (priority.toUpperCase()) {
            case "HIGH" -> 1;
            case "LOW" -> 3;
            default -> 2;
        };
    }

    private String normalizePriority(String priority) {
        if (priority == null) {
            return "NORMAL";
        }

        String normalized = priority.toUpperCase();
        return switch (normalized) {
            case "HIGH", "LOW" -> normalized;
            default -> "NORMAL";
        };
    }

    private static LocalDateTime later(LocalDateTime first,
                                       LocalDateTime second,
                                       LocalDateTime third) {
        LocalDateTime result = first.isAfter(second) ? first : second;
        return result.isAfter(third) ? result : third;
    }

    private static LocalDateTime earlier(LocalDateTime first,
                                         LocalDateTime second) {
        return first.isBefore(second) ? first : second;
    }

    private static String joinReasons(List<String> first, List<String> second) {
        List<String> combined = new ArrayList<>();
        if (first != null) {
            combined.addAll(first);
        }
        if (second != null) {
            combined.addAll(second);
        }
        return combined.isEmpty() ? null : String.join("; ", combined);
    }
}
