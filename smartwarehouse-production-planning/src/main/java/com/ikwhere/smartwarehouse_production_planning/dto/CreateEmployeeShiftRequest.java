package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record CreateEmployeeShiftRequest(
        @NotNull LocalTime shiftStart,
        @NotNull LocalTime shiftEnd,
        String workingDays
) {
}
