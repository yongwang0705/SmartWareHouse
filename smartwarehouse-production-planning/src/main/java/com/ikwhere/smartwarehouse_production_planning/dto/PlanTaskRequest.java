package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDateTime;

public record PlanTaskRequest(
        @NotNull Long orderId,
        @NotNull Long productId,
        @NotNull @Positive Integer quantity,
        @NotNull LocalDateTime startTime,
        @NotNull LocalDateTime endTime,
        LocalDateTime dueDate,
        Long lineId,
        String priority
) {
}
