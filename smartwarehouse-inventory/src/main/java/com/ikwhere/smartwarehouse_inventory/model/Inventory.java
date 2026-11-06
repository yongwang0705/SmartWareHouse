package com.ikwhere.smartwarehouse_inventory.model;

import java.time.LocalDateTime;

public record Inventory(
        Long id,
        Long productId,
        String productName,
        Integer quantity,
        Integer reservedQuantity,
        LocalDateTime updatedAt
) {
    public Integer getAvailableQuantity() {
        return quantity - reservedQuantity;
    }
}