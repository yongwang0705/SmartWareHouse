package com.ikwhere.smartwarehouse_inventory.dto;

public record BomItemResponse(
        Long parentProductId,
        String parentProductName,
        Long componentProductId,
        String componentProductName,
        Integer quantityRequired
) {}
