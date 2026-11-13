package com.ikwhere.smartwarehouse_production_planning.engine;

import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse_production_planning.model.ProductBom;
import com.ikwhere.smartwarehouse_production_planning.model.RoutingOperation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SchedulingEngineTest {

    private SchedulingEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SchedulingEngine(null);
    }

    @Test
    void testOrderSorting() {
        ProductionOrderDto o1 = ProductionOrderDto.newBuilder().setOrderId(1).setStatus("NORMAL").setCreatedAt("2026-11-12T10:00:00").build();
        ProductionOrderDto o2 = ProductionOrderDto.newBuilder().setOrderId(2).setStatus("HIGH").setCreatedAt("2026-11-12T11:00:00").build();

        List<ProductionOrderDto> sorted = engine.sortOrders(List.of(o1, o2));

        assertEquals(2, sorted.get(0).getOrderId()); // HIGH priority first
        assertEquals(1, sorted.get(1).getOrderId());
    }

    @Test
    void testProductionQuantityCalculation() {
        InventoryResponse inv = InventoryResponse.newBuilder().setQuantity(10).setReservedQuantity(2).setAvailableQuantity(8).build();
        int qty = engine.calculateProductionQuantity(20, inv);
        assertEquals(12, qty); // 20 - 8 = 12

        qty = engine.calculateProductionQuantity(5, inv);
        assertEquals(0, qty); // 5 - 8 = -3 -> 0
    }

    @Test
    void testMaterialValidation() {
        ProductBom bom = new ProductBom(1L, 101L, 201L, 2, true, null);
        InventoryResponse matInv = InventoryResponse.newBuilder().setAvailableQuantity(10).build();

        boolean valid = engine.validateMaterials(List.of(bom), 5, Map.of(201L, matInv));
        assertTrue(valid); // Requires 2 * 5 = 10, Available 10 -> True

        valid = engine.validateMaterials(List.of(bom), 6, Map.of(201L, matInv));
        assertFalse(valid); // Requires 2 * 6 = 12, Available 10 -> False
    }

    @Test
    void testOperationMinutesCalculation() {
        RoutingOperation op = new RoutingOperation(1L, 1L, 1, "Assemble", 1L, "SKILL_ASM", new BigDecimal("5.0"), new BigDecimal("10.0"));
        BigDecimal minutes = engine.calculateOperationMinutes(op, 10);
        assertEquals(new BigDecimal("60.0"), minutes); // 10 setup + 10 * 5 = 60 minutes
    }
}
