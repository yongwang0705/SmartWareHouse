package com.ikwhere.smartwarehouse_production_planning.model;

public record ProductionLine(
        Long id,
        String code,
        String name,
        Integer employees,
        Integer unitsPerHour,
        Boolean active
) {
}
