package com.ikwhere.smartwarehouse_inventory.dto;

import java.math.BigDecimal;

public record WarehousePlotResponse(
        Long id,
        String code,
        String name,
        String plotType,
        BigDecimal surfaceArea,
        BigDecimal occupiedArea,
        Double occupancyPercent,
        Long productId,
        String productName,
        Boolean isProduct,
        Integer capacityUnits,
        Integer occupiedUnits,
        String status
) {
}
