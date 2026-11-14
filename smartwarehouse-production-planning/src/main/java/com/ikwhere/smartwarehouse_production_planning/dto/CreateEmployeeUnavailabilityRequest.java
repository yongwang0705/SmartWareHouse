package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record CreateEmployeeUnavailabilityRequest(
        @NotNull LocalDateTime startTime,
        @NotNull LocalDateTime endTime,
        String reason
) {
}
