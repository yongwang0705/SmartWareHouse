package com.ikwhere.smartwarehouse_inventory.dto;

public record MovePlotItemsResponse(
        WarehousePlotResponse source,
        WarehousePlotResponse destination
) {
}
