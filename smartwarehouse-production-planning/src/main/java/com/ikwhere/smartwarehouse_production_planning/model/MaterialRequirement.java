package com.ikwhere.smartwarehouse_production_planning.model;

public record MaterialRequirement(
        Long id,
        Long productionTaskId,
        Long materialProductId,
        Integer requiredQuantity,
        Integer reservedQuantity,
        String status
) {
}
