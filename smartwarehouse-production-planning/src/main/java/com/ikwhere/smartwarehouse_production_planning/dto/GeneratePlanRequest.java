package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record GeneratePlanRequest(
        @NotNull(message = "planningStart is required")
        LocalDate planningStart,

        @NotNull(message = "planningEnd is required")
        LocalDate planningEnd,

        // Optional: exact date and hour production may start. Defaults to
        // planningStart at 00:00 when omitted.
        LocalDateTime scheduleStart,

        String algorithm
) {
}
