package com.ikwhere.smartwarehouse_production_planning.engine;

import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionLine;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Line-based scheduler. A production line converts its configured
 * units-per-hour into working-time usage; employees are only an attribute of
 * the line (headcount), not individual schedulable resources.
 */
@Component
public class LineSchedulingEngine {

    public static final LocalTime DEFAULT_WORK_START = LocalTime.of(8, 0);
    public static final LocalTime DEFAULT_WORK_END = LocalTime.of(17, 0);
    private static final int HORIZON_DAYS = 90;

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

    public record WorkDay(boolean working, LocalTime start, LocalTime end) {
    }

    public record ExistingLineBooking(
            Long lineId,
            LocalDateTime start,
            LocalDateTime end
    ) {
    }

    public record SchedulingInput(
            List<OrderDemand> orders,
            Map<Long, Integer> availableInventory,
            Map<Long, List<ProductBom>> boms,
            List<ProductionLine> lines,
            Map<LocalDate, WorkDay> calendar,
            List<ExistingLineBooking> existingBookings,
            LocalDateTime planningStart
    ) {
    }

    public record LineAssignment(
            Long lineId,
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
            List<LineAssignment> lineAssignments,
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

    private record TimeWindow(LocalDateTime start, LocalDateTime end) {
    }

    private record Chunk(LocalDateTime start, LocalDateTime end) {
    }

    private record Candidate(Long lineId, List<Chunk> chunks) {
        LocalDateTime start() {
            return chunks.get(0).start();
        }

        LocalDateTime end() {
            return chunks.get(chunks.size() - 1).end();
        }
    }

    public PlanResult generate(SchedulingInput input) {
        Map<Long, Integer> inventory = new HashMap<>(input.availableInventory());

        List<ProductionLine> lines = input.lines() == null
                ? List.of()
                : input.lines().stream()
                        .filter(line -> line.active() != null && line.active())
                        .sorted(Comparator.comparing(ProductionLine::id))
                        .toList();

        Map<Long, List<TimeWindow>> lineBusy = new HashMap<>();
        lines.forEach(line -> lineBusy.put(line.id(), new ArrayList<>()));

        if (input.existingBookings() != null) {
            for (ExistingLineBooking booking : input.existingBookings()) {
                if (booking.lineId() != null) {
                    lineBusy
                            .computeIfAbsent(
                                    booking.lineId(),
                                    key -> new ArrayList<>()
                            )
                            .add(new TimeWindow(
                                    booking.start(),
                                    booking.end()
                            ));
                }
            }
        }

        LocalDateTime planningStart = input.planningStart() == null
                ? LocalDateTime.now().withNano(0)
                : input.planningStart().withNano(0);

        List<TaskResult> tasks = new ArrayList<>();

        for (OrderDemand order : sortOrders(input.orders())) {
            List<OrderLine> orderLines = order.items() == null
                    ? List.of()
                    : order.items().stream()
                            .sorted(Comparator.comparing(OrderLine::productId))
                            .toList();

            for (OrderLine line : orderLines) {
                int orderedQuantity = Math.max(0, line.quantity());
                if (orderedQuantity == 0) {
                    continue;
                }

                int availableFinished =
                        inventory.getOrDefault(line.productId(), 0);
                int allocated = Math.min(availableFinished, orderedQuantity);
                inventory.put(
                        line.productId(),
                        availableFinished - allocated
                );

                int productionQuantity = orderedQuantity - allocated;
                if (productionQuantity <= 0) {
                    continue;
                }

                MaterialEvaluation materials = evaluateMaterials(
                        line.productId(),
                        productionQuantity,
                        input.boms(),
                        inventory
                );

                Candidate best = null;

                for (ProductionLine productionLine : lines) {
                    if (productionLine.unitsPerHour() == null
                            || productionLine.unitsPerHour() <= 0) {
                        continue;
                    }

                    long requiredMinutes = requiredMinutes(
                            productionQuantity,
                            productionLine.unitsPerHour()
                    );

                    Candidate candidate = simulate(
                            productionLine,
                            requiredMinutes,
                            planningStart,
                            input.calendar(),
                            lineBusy.getOrDefault(
                                    productionLine.id(),
                                    List.of()
                            )
                    );

                    if (candidate == null) {
                        continue;
                    }

                    if (best == null
                            || candidate.end().isBefore(best.end())
                            || (candidate.end().equals(best.end())
                                && productionLine.id() < best.lineId())) {
                        best = candidate;
                    }
                }

                if (best == null) {
                    tasks.add(new TaskResult(
                            order.orderId(),
                            line.productId(),
                            productionQuantity,
                            order.dueDate(),
                            normalizePriority(order.priority()),
                            "CAPACITY_SHORTAGE",
                            "No production line has available capacity",
                            null,
                            null,
                            null,
                            List.of(),
                            materials.requirements()
                    ));
                    continue;
                }

                Candidate selected = best;

                lineBusy.get(selected.lineId()).addAll(
                        selected.chunks().stream()
                                .map(chunk -> new TimeWindow(
                                        chunk.start(),
                                        chunk.end()
                                ))
                                .toList()
                );

                List<LineAssignment> assignments = selected.chunks().stream()
                        .map(chunk -> {
                            long minutes = Duration.between(
                                    chunk.start(),
                                    chunk.end()
                            ).toMinutes();

                            return new LineAssignment(
                                    selected.lineId(),
                                    chunk.start(),
                                    chunk.end(),
                                    BigDecimal.valueOf(minutes)
                                            .divide(
                                                    BigDecimal.valueOf(60),
                                                    2,
                                                    RoundingMode.HALF_UP
                                            )
                            );
                        })
                        .toList();

                LocalDateTime startTime = selected.start();
                LocalDateTime endTime = selected.end();

                String status;
                String statusReason;

                if (!materials.shortages().isEmpty()) {
                    status = "MATERIAL_SHORTAGE";
                    statusReason = String.join("; ", materials.shortages());
                } else if (order.dueDate() != null
                        && endTime.isAfter(order.dueDate())) {
                    status = "AT_RISK";
                    statusReason = "Estimated completion " + endTime
                            + " is after due date " + order.dueDate();
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
                        startTime,
                        endTime,
                        endTime,
                        assignments,
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

    private long requiredMinutes(int quantity, int unitsPerHour) {
        return (long) Math.ceil(
                quantity * 60.0 / unitsPerHour
        );
    }

    private Candidate simulate(ProductionLine line,
                               long requiredMinutes,
                               LocalDateTime earliest,
                               Map<LocalDate, WorkDay> calendar,
                               List<TimeWindow> busy) {

        if (requiredMinutes <= 0) {
            return new Candidate(
                    line.id(),
                    List.of(new Chunk(earliest, earliest))
            );
        }

        long remaining = requiredMinutes;
        List<Chunk> chunks = new ArrayList<>();
        LocalDate date = earliest.toLocalDate();
        LocalDate lastDay = date.plusDays(HORIZON_DAYS);

        while (remaining > 0 && !date.isAfter(lastDay)) {
            WorkDay workDay = resolveWorkDay(calendar, date);

            if (workDay.working()) {
                LocalTime dayStart = workDay.start() == null
                        ? DEFAULT_WORK_START
                        : workDay.start();
                LocalTime dayEnd = workDay.end() == null
                        ? DEFAULT_WORK_END
                        : workDay.end();

                LocalDateTime plantStart = date.atTime(dayStart);
                LocalDateTime plantEnd = date.atTime(dayEnd);
                LocalDateTime from = later(plantStart, earliest);
                LocalDateTime to = plantEnd;

                if (from.isBefore(to)) {
                    for (TimeWindow gap : freeGaps(busy, from, to)) {
                        long gapMinutes = Duration.between(
                                gap.start(),
                                gap.end()
                        ).toMinutes();

                        long allocation = Math.min(remaining, gapMinutes);

                        if (allocation <= 0) {
                            continue;
                        }

                        chunks.add(new Chunk(
                                gap.start(),
                                gap.start().plusMinutes(allocation)
                        ));

                        remaining -= allocation;

                        if (remaining <= 0) {
                            break;
                        }
                    }
                }
            }

            date = date.plusDays(1);
        }

        return remaining <= 0
                ? new Candidate(line.id(), chunks)
                : null;
    }

    private List<TimeWindow> freeGaps(List<TimeWindow> busy,
                                      LocalDateTime from,
                                      LocalDateTime to) {
        List<TimeWindow> gaps = new ArrayList<>();
        LocalDateTime cursor = from;

        List<TimeWindow> sorted = busy == null
                ? List.of()
                : busy.stream()
                        .sorted(Comparator.comparing(TimeWindow::start))
                        .toList();

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

            cursor = later(cursor, window.end());

            if (!cursor.isBefore(to)) {
                break;
            }
        }

        if (cursor.isBefore(to)) {
            gaps.add(new TimeWindow(cursor, to));
        }

        return gaps.stream()
                .filter(gap -> gap.start().isBefore(gap.end()))
                .toList();
    }

    private WorkDay resolveWorkDay(Map<LocalDate, WorkDay> calendar,
                                   LocalDate date) {
        if (calendar != null) {
            WorkDay configured = calendar.get(date);
            if (configured != null) {
                return configured;
            }
        }

        DayOfWeek day = date.getDayOfWeek();
        boolean working = day != DayOfWeek.SATURDAY
                && day != DayOfWeek.SUNDAY;

        return new WorkDay(
                working,
                DEFAULT_WORK_START,
                DEFAULT_WORK_END
        );
    }

    private MaterialEvaluation evaluateMaterials(
            Long productId,
            int productionQuantity,
            Map<Long, List<ProductBom>> boms,
            Map<Long, Integer> inventory) {

        List<ProductBom> productBoms = boms == null
                ? List.of()
                : boms.getOrDefault(productId, List.of());

        List<MaterialRequirementResult> requirements = new ArrayList<>();
        List<String> shortages = new ArrayList<>();

        for (ProductBom bom : productBoms) {
            int required = bom.quantityPerUnit() * productionQuantity;
            int available = inventory.getOrDefault(
                    bom.materialProductId(),
                    0
            );
            int reserved = Math.min(required, Math.max(0, available));
            String status = reserved >= required
                    ? "RESERVED"
                    : "SHORTAGE";

            inventory.put(
                    bom.materialProductId(),
                    Math.max(0, available - reserved)
            );

            if (reserved < required) {
                shortages.add(
                        "Material " + bom.materialProductId()
                                + " short by " + (required - reserved)
                );
            }

            requirements.add(new MaterialRequirementResult(
                    bom.materialProductId(),
                    required,
                    reserved,
                    status,
                    null
            ));
        }

        return new MaterialEvaluation(requirements, shortages);
    }

    private record MaterialEvaluation(
            List<MaterialRequirementResult> requirements,
            List<String> shortages
    ) {
    }

    private List<OrderDemand> sortOrders(List<OrderDemand> orders) {
        if (orders == null) {
            return List.of();
        }

        Comparator<OrderDemand> comparator = Comparator
                .comparing((OrderDemand order) -> order.dueDate() == null
                        ? LocalDateTime.MAX
                        : order.dueDate())
                .thenComparingInt((OrderDemand order) -> priorityWeight(
                        order.priority()
                ))
                .thenComparing(order -> order.createdAt() == null
                        ? LocalDateTime.MAX
                        : order.createdAt())
                .thenComparing(
                        OrderDemand::orderId,
                        Comparator.nullsLast(Long::compareTo)
                );

        return orders.stream().sorted(comparator).toList();
    }

    private int priorityWeight(String priority) {
        if (priority == null) {
            return 1;
        }

        return switch (priority.toUpperCase()) {
            case "HIGH" -> 0;
            case "LOW" -> 2;
            default -> 1;
        };
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

    private static LocalDateTime later(LocalDateTime... values) {
        LocalDateTime result = values[0];

        for (LocalDateTime value : values) {
            if (value.isAfter(result)) {
                result = value;
            }
        }

        return result;
    }

    private static LocalDateTime earlier(LocalDateTime first,
                                         LocalDateTime second) {
        return first.isBefore(second) ? first : second;
    }
}
