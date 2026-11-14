package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record GeneratePlanRequest(
        @NotNull(message = "planningStart is required")
        LocalDate planningStart,

        @NotNull(message = "planningEnd is required")
        LocalDate planningEnd,

        String algorithm
) {
}
