package com.ikwhere.smartwarehouse_inventory.dto;

import java.math.BigDecimal;
import java.util.List;

public record WarehouseResponse(
        Long id,
        String code,
        String name,
        String address,
        BigDecimal surfaceArea,
        BigDecimal allocatedArea,
        BigDecimal occupiedArea,
        Double utilizationPercent,
        Integer plotCount,
        Integer assignedPlotCount,
        List<WarehousePlotResponse> plots
) {
}
