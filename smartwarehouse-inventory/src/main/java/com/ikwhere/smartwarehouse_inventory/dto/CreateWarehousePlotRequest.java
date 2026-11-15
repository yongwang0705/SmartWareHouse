package com.ikwhere.smartwarehouse_inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateWarehousePlotRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 150) String name,
        @NotBlank String plotType,
        @NotNull @DecimalMin("0.01") BigDecimal surfaceArea,
        @DecimalMin("0") BigDecimal occupiedArea,
        Long productId,
        @Min(0) Integer capacityUnits,
        @Min(0) Integer occupiedUnits
) {
}
