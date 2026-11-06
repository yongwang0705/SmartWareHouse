package com.ikwhere.smartwarehouse_order_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import org.jetbrains.annotations.NotNull;

import java.util.List;

public record OrderItemRequest(
        @NotNull
        @Positive
        Long productId,

        @NotNull
        @Positive
        Integer quantity

) {
}