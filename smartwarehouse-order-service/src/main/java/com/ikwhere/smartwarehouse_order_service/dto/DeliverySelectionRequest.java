package com.ikwhere.smartwarehouse_order_service.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/**
 * Delivery plan chosen by the user when completing an order. The frontend
 * quotes all feasible modes and lets the user accept or override the
 * recommendation, so the selected quote is sent with the completion request.
 */
public record DeliverySelectionRequest(
        @NotBlank String mode,
        @NotBlank String carrier,
        @NotBlank String destination,
        @NotNull @PositiveOrZero BigDecimal distanceKm,
        @NotNull @Min(0) Integer transitDays,
        @NotNull @PositiveOrZero BigDecimal price,
        String container
) {
}
