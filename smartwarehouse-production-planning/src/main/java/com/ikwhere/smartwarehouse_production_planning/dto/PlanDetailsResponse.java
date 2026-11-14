package com.ikwhere.smartwarehouse_production_planning.dto;

import java.time.LocalDateTime;
import java.util.List;

public record PlanDetailsResponse(
        Long planId,
        String planNumber,
        String status,
        LocalDateTime planningStart,
        LocalDateTime planningEnd,
        String algorithm,
        String reservationReference,
        String failureReason,
        LocalDateTime createdAt,
        List<TaskResponse> tasks
) {
}
