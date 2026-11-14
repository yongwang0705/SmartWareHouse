package com.ikwhere.smartwarehouse_production_planning.dto;

public record MaterialRequirementResponse(
        Long requirementId,
        Long materialProductId,
        int requiredQuantity,
        int reservedQuantity,
        String status
) {
}
