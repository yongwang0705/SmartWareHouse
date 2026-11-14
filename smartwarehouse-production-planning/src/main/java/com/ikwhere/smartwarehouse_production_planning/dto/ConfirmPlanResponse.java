package com.ikwhere.smartwarehouse_production_planning.dto;

public record ConfirmPlanResponse(
        Long planId,
        String status,
        String message
) {
}
