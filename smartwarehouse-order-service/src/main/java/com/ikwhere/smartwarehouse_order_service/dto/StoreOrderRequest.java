package com.ikwhere.smartwarehouse_order_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Places a completed order's products into warehouse plots before shipping.
 * The allocations must cover every ordered line exactly.
 */
public record StoreOrderRequest(
        @NotNull @Size(min = 1) @Valid
        List<StorageAllocation> allocations
) {
    public record StorageAllocation(
            @NotNull Long plotId,
            @NotNull Long productId,
            @NotNull @Min(1) Integer quantity
    ) {
    }
}
