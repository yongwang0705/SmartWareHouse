package com.ikwhere.smartwarehouse_production_planning.dto;

public record CancelPlanResponse(
        Long planId,
        String status,
        String message
) {
}
