package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CreateRoutingOperationRequest(
        @NotNull @Positive Integer sequenceNumber,
        @NotBlank String operationName,
        @NotNull Long workCenterId,
        @NotBlank String skillCode,
        @NotNull @DecimalMin("0") BigDecimal minutesPerUnit,
        @DecimalMin("0") BigDecimal setupMinutes
) {
}
