package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalDateTime;

public record ProductionPlan(
        Long id,
        String planNumber,
        String status,
        LocalDateTime planningStart,
        LocalDateTime planningEnd,
        String algorithm,
        String reservationReference,
        String failureReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
