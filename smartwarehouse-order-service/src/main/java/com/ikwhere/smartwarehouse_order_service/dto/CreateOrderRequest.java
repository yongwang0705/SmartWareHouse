package com.ikwhere.smartwarehouse_order_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.util.List;

public record CreateOrderRequest(

        @NotNull
        @Positive
        Long customerId,

        @NotEmpty
        List<@Valid OrderItemRequest> items,

        // Optional: defaults to seven days from creation when omitted.
        LocalDate dueDate,

        // Optional: HIGH, NORMAL or LOW. Defaults to NORMAL when omitted.
        @Pattern(regexp = "HIGH|NORMAL|LOW", message = "priority must be HIGH, NORMAL or LOW")
        String priority

) {
}
