package com.ikwhere.smartwarehouse_production_planning.engine;

import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse_production_planning.model.*;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
public class SchedulingEngine {

    private final ConfigurationRepository configurationRepository;

    public SchedulingEngine(ConfigurationRepository configurationRepository) {
        this.configurationRepository = configurationRepository;
    }

    public record ScheduledTaskResult(
        ProductionOrderDto order,
        Long productId,
        int quantityToProduce,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String status,
        String riskReason
    ) {}

    public List<ProductionOrderDto> sortOrders(List<ProductionOrderDto> orders) {
        // Sort by Priority (HIGH -> NORMAL -> LOW), then Due Date, then Creation Time, then Order ID
        return orders.stream()
                .sorted(Comparator
                        .comparing((ProductionOrderDto o) -> getPriorityWeight(o.getStatus())) // Using status/priority heuristic
                        .thenComparing(ProductionOrderDto::getCreatedAt)
                        .thenComparing(ProductionOrderDto::getOrderId))
                .toList();
    }

    private int getPriorityWeight(String priority) {
        if (priority == null) return 2;
        return switch (priority.toUpperCase()) {
            case "HIGH" -> 1;
            case "NORMAL" -> 2;
            case "LOW" -> 3;
            default -> 2;
        };
    }

    public int calculateProductionQuantity(int orderQuantity, InventoryResponse finishedGoodsInventory) {
        int availableFinishedGoods = finishedGoodsInventory != null ? finishedGoodsInventory.getAvailableQuantity() : 0;
        int productionQuantity = orderQuantity - availableFinishedGoods;
        return Math.max(0, productionQuantity);
    }

    public boolean validateMaterials(List<ProductBom> boms, int productionQuantity, Map<Long, InventoryResponse> materialInventories) {
        for (ProductBom bom : boms) {
            int required = bom.quantityPerUnit() * productionQuantity;
            InventoryResponse inv = materialInventories.get(bom.materialProductId());
            int available = inv != null ? inv.getAvailableQuantity() : 0;
            if (available < required) {
                return false;
            }
        }
        return true;
    }

    public BigDecimal calculateOperationMinutes(RoutingOperation op, int productionQuantity) {
        // Processing Minutes = Setup Minutes + Production Quantity * Minutes Per Unit
        BigDecimal totalMinutes = op.setupMinutes().add(op.minutesPerUnit().multiply(BigDecimal.valueOf(productionQuantity)));
        return totalMinutes;
    }
}
