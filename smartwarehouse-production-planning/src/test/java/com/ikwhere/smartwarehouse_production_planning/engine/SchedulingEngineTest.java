package com.ikwhere.smartwarehouse_production_planning.engine;

import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.EmployeeResource;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OperationAssignment;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OrderDemand;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.OrderLine;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.PlanResult;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.SchedulingInput;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine.TaskResult;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;
import com.ikwhere.smartwarehouse_production_planning.model.WorkCenter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SchedulingEngineTest {

    private static final LocalDateTime PLAN_START =
            LocalDateTime.of(2026, 11, 12, 8, 0);

    private SchedulingEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SchedulingEngine();
    }

    // 1. HIGH priority before NORMAL
    @Test
    void highPriorityIsScheduledBeforeNormalPriority() {
        OrderDemand normal = order(1L, "NORMAL", PLAN_START.plusDays(2));
        OrderDemand high = order(2L, "HIGH", PLAN_START.plusDays(2));

        List<OrderDemand> sorted = engine.sortOrders(List.of(normal, high));

        assertEquals(2L, sorted.get(0).orderId());
        assertEquals(1L, sorted.get(1).orderId());
    }

    // 2. Earlier due date before later due date
    @Test
    void earlierDueDateIsScheduledFirst() {
        OrderDemand later = order(1L, "NORMAL", PLAN_START.plusDays(5));
        OrderDemand earlier = order(2L, "NORMAL", PLAN_START.plusDays(2));

        List<OrderDemand> sorted = engine.sortOrders(List.of(later, earlier));

        assertEquals(2L, sorted.get(0).orderId());
        assertEquals(1L, sorted.get(1).orderId());
    }

    // 3. Finished goods reduce production quantity
    @Test
    void finishedGoodsReduceProductionQuantity() {
        PlanResult result = engine.generate(baseInput(
                List.of(order(1L, "NORMAL", PLAN_START.plusDays(5), 20)),
                Map.of(101L, 5),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        ));

        assertEquals(1, result.tasks().size());
        assertEquals(15, result.tasks().get(0).quantity());
    }

    // 4. Insufficient material produces MATERIAL_SHORTAGE
    @Test
    void insufficientMaterialProducesMaterialShortage() {
        ProductBom bom = new ProductBom(
                1L,
                101L,
                201L,
                2,
                true,
                PLAN_START
        );

        PlanResult result = engine.generate(baseInput(
                List.of(order(1L, "NORMAL", PLAN_START.plusDays(5), 5)),
                Map.of(201L, 5),
                Map.of(101L, List.of(bom)),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        ));

        TaskResult task = result.tasks().get(0);
        assertEquals("MATERIAL_SHORTAGE", task.status());
        assertEquals(1, result.materialShortageOrders());
        assertEquals(10, task.materials().get(0).requiredQuantity());
        assertEquals(5, task.materials().get(0).reservedQuantity());
    }

    // 5. Insufficient work center capacity produces CAPACITY_SHORTAGE
    @Test
    void insufficientWorkCenterCapacityProducesCapacityShortage() {
        WorkCenter noCapacity = new WorkCenter(
                1L,
                "WC-ASSEMBLY",
                "Assembly",
                0.0,
                true
        );

        PlanResult result = engine.generate(baseInput(
                List.of(order(1L, "NORMAL", PLAN_START.plusDays(5), 2)),
                Map.of(),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY")),
                Map.of(1L, noCapacity)
        ));

        assertEquals("CAPACITY_SHORTAGE", result.tasks().get(0).status());
        assertEquals(1, result.capacityShortageOrders());
    }

    // 6. Employee without the required skill cannot be assigned
    @Test
    void employeeWithoutRequiredSkillCannotBeAssigned() {
        PlanResult result = engine.generate(baseInput(
                List.of(order(1L, "NORMAL", PLAN_START.plusDays(5), 2)),
                Map.of(),
                Map.of(),
                defaultOperations(),
                List.of(employee("PACKAGING"))
        ));

        assertEquals("CAPACITY_SHORTAGE", result.tasks().get(0).status());
        assertTrue(result.tasks().get(0).assignments().isEmpty());
    }

    // 7. Employee cannot be double-booked
    @Test
    void employeeIsNotDoubleBooked() {
        PlanResult result = engine.generate(baseInput(
                List.of(
                        order(1L, "NORMAL", PLAN_START.plusDays(5), 4),
                        order(2L, "NORMAL", PLAN_START.plusDays(5), 4)
                ),
                Map.of(),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        ));

        List<OperationAssignment> assignments = allAssignments(result);
        assertEquals(2, assignments.size());
        assertFalse(overlaps(assignments.get(0), assignments.get(1)));
    }

    // 8. Work center cannot exceed capacity
    @Test
    void workCenterCapacityIsNeverExceeded() {
        PlanResult result = engine.generate(baseInput(
                List.of(
                        order(1L, "NORMAL", PLAN_START.plusDays(10), 4),
                        order(2L, "NORMAL", PLAN_START.plusDays(10), 4),
                        order(3L, "NORMAL", PLAN_START.plusDays(10), 4)
                ),
                Map.of(),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        ));

        Map<LocalDate, BigDecimal> hoursPerDay = new HashMap<>();

        for (OperationAssignment assignment : allAssignments(result)) {
            hoursPerDay.merge(
                    assignment.start().toLocalDate(),
                    assignment.allocatedHours(),
                    BigDecimal::add
            );
        }

        for (BigDecimal hours : hoursPerDay.values()) {
            assertTrue(
                    hours.compareTo(BigDecimal.valueOf(8)) <= 0,
                    "Work center exceeded 8 hours on a day: " + hours
            );
        }
    }

    // 9. Operations must execute in sequence
    @Test
    void operationsExecuteInSequence() {
        List<RoutingOperation> operations = List.of(
                operation(1L, 1, "Assemble", "ASSEMBLY", "60"),
                operation(2L, 2, "Test", "TESTING", "30")
        );

        PlanResult result = engine.generate(baseInput(
                List.of(order(1L, "NORMAL", PLAN_START.plusDays(5), 1)),
                Map.of(),
                Map.of(),
                Map.of(101L, operations),
                List.of(
                        employee("ASSEMBLY"),
                        employee(2L, "TESTING")
                )
        ));

        List<OperationAssignment> assignments = result.tasks().get(0)
                .assignments();

        assertEquals(2, assignments.size());
        assertTrue(
                !assignments.get(1).start().isBefore(assignments.get(0).end()),
                "Second operation started before the first completed"
        );
    }

    // 10. Late completion produces AT_RISK
    @Test
    void lateCompletionProducesAtRisk() {
        PlanResult result = engine.generate(baseInput(
                List.of(order(
                        1L,
                        "NORMAL",
                        PLAN_START.plusMinutes(30),
                        8
                )),
                Map.of(),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        ));

        TaskResult task = result.tasks().get(0);
        assertEquals("AT_RISK", task.status());
        assertNotNull(task.endTime());
        assertTrue(task.endTime().isAfter(task.dueDate()));
    }

    // 11. Identical inputs produce deterministic results
    @Test
    void identicalInputsProduceDeterministicResults() {
        SchedulingInput input = baseInput(
                List.of(
                        order(2L, "NORMAL", PLAN_START.plusDays(5), 3),
                        order(1L, "HIGH", PLAN_START.plusDays(6), 2)
                ),
                Map.of(101L, 1),
                Map.of(),
                defaultOperations(),
                List.of(employee("ASSEMBLY"))
        );

        PlanResult first = engine.generate(input);
        PlanResult second = engine.generate(input);

        assertEquals(first, second);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private OrderDemand order(Long orderId,
                              String priority,
                              LocalDateTime dueDate) {
        return order(orderId, priority, dueDate, 2);
    }

    private OrderDemand order(Long orderId,
                              String priority,
                              LocalDateTime dueDate,
                              int quantity) {
        return new OrderDemand(
                orderId,
                1000L + orderId,
                dueDate,
                priority,
                PLAN_START.minusDays(1),
                List.of(new OrderLine(101L, quantity))
        );
    }

    private EmployeeResource employee(String skill) {
        return employee(1L, skill);
    }

    private EmployeeResource employee(Long id, String skill) {
        return new EmployeeResource(
                id,
                Set.of(skill),
                List.of(),
                List.of()
        );
    }

    private RoutingOperation operation(Long id,
                                       int sequence,
                                       String name,
                                       String skill,
                                       String minutesPerUnit) {
        return new RoutingOperation(
                id,
                1L,
                sequence,
                name,
                1L,
                skill,
                new BigDecimal(minutesPerUnit),
                BigDecimal.ZERO
        );
    }

    private Map<Long, List<RoutingOperation>> defaultOperations() {
        return Map.of(101L, List.of(
                operation(1L, 1, "Assembly", "ASSEMBLY", "60")
        ));
    }

    private SchedulingInput baseInput(List<OrderDemand> orders,
                                      Map<Long, Integer> inventory,
                                      Map<Long, List<ProductBom>> boms,
                                      Map<Long, List<RoutingOperation>> routings,
                                      List<EmployeeResource> employees) {
        return baseInput(
                orders,
                inventory,
                boms,
                routings,
                employees,
                Map.of(1L, new WorkCenter(
                        1L,
                        "WC-ASSEMBLY",
                        "Assembly",
                        8.0,
                        true
                ))
        );
    }

    private SchedulingInput baseInput(List<OrderDemand> orders,
                                      Map<Long, Integer> inventory,
                                      Map<Long, List<ProductBom>> boms,
                                      Map<Long, List<RoutingOperation>> routings,
                                      List<EmployeeResource> employees,
                                      Map<Long, WorkCenter> workCenters) {
        return new SchedulingInput(
                orders,
                new HashMap<>(inventory),
                boms,
                routings,
                workCenters,
                employees,
                Map.of(),
                List.of(),
                PLAN_START
        );
    }

    private List<OperationAssignment> allAssignments(PlanResult result) {
        List<OperationAssignment> assignments = new ArrayList<>();

        for (TaskResult task : result.tasks()) {
            assignments.addAll(task.assignments());
        }

        return assignments;
    }

    private boolean overlaps(OperationAssignment first,
                             OperationAssignment second) {
        return first.start().isBefore(second.end())
                && second.start().isBefore(first.end());
    }
}
