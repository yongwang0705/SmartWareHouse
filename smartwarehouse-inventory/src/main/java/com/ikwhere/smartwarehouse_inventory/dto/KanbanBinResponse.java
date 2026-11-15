package com.ikwhere.smartwarehouse_inventory.dto;

public record KanbanBinResponse(
        String binId,
        Long productId,
        String productName,
        Integer capacity,
        Integer currentStock,
        Integer reservedQuantity,
        Integer availableQuantity,
        Integer triggerLevel,
        Boolean jitEnabled,
        String status,
        Double fillPercent,
        Long stockAgeDays,
        Long deployedDays,
        Long daysSinceTrigger
) {
}
