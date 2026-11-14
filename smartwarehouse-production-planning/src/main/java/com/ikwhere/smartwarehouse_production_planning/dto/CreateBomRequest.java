package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateBomRequest(
        @NotNull Long productId,
        @NotNull Long materialProductId,
        @NotNull @Positive Integer quantityPerUnit
) {
}
