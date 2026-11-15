package com.ikwhere.smartwarehouse_inventory.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record Inventory(
        Long id,
        Long productId,
        String productName,
        Integer quantity,
        Integer reservedQuantity,
        LocalDateTime updatedAt,
        @JsonProperty("isProduct") Boolean isProduct
) {
    public Integer getAvailableQuantity() {
        return quantity - reservedQuantity;
    }
}
