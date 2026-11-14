package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalDateTime;

public record ProductionTask(
        Long id,
        Long planId,
        Long orderId,
        Long productId,
        Integer quantity,
        LocalDateTime dueDate,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String priority,
        String status,
        String statusReason,
        LocalDateTime estimatedCompletion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
