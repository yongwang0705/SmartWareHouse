package com.ikwhere.smartwarehouse_inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record MovePlotItemsRequest(
        @NotNull Long destinationPlotId,
        @NotNull @Min(1) Integer quantity
) {
}
