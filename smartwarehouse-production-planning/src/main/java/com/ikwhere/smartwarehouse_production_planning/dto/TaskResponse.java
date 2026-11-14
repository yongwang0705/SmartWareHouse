package com.ikwhere.smartwarehouse_production_planning.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TaskResponse(
        Long taskId,
        Long planId,
        Long orderId,
        Long productId,
        int quantity,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LocalDateTime dueDate,
        LocalDateTime estimatedCompletion,
        String priority,
        String status,
        String statusReason,
        List<AssignmentResponse> assignments,
        List<MaterialRequirementResponse> materials
) {
}
