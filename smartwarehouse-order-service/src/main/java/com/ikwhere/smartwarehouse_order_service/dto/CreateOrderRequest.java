package com.ikwhere.smartwarehouse_order_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.util.List;

public record CreateOrderRequest(

        @NotNull
        @Positive
        Long customerId,

        @NotEmpty
        List<@Valid OrderItemRequest> items

) {
}