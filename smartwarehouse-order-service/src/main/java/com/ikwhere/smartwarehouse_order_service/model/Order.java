package com.ikwhere.smartwarehouse_order_service.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record Order(
        Long id,
        Long customerId,
        String status,
        BigDecimal totalAmount,
        LocalDateTime createdAt
) {
}