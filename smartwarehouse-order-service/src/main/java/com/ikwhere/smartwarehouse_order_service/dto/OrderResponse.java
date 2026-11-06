package com.ikwhere.smartwarehouse_order_service.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderResponse(
        Long id,

        Long customerId,

        String status,

        BigDecimal totalAmount,

        LocalDateTime createdAt,

        List<OrderItemResponse> items
) {
}
