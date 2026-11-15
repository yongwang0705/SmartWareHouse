package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ReplenishPlanRequest(
        @NotNull Long productId,
        @NotNull @Positive Integer targetQuantity,
        @NotNull LocalDate planningStart,
        @NotNull LocalDate planningEnd,

        // Optional: exact date and hour production may start. Defaults to
        // planningStart at 00:00 when omitted.
        LocalDateTime scheduleStart
) {
}
