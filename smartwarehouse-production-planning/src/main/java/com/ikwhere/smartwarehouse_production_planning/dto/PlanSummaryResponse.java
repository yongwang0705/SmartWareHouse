package com.ikwhere.smartwarehouse_production_planning.dto;

import java.time.LocalDateTime;

public record PlanSummaryResponse(
        Long planId,
        String planNumber,
        String status,
        LocalDateTime planningStart,
        LocalDateTime planningEnd,
        String algorithm,
        int totalOrders,
        int scheduledOrders,
        int atRiskOrders,
        int materialShortageOrders,
        int capacityShortageOrders,
        LocalDateTime createdAt
) {
}
