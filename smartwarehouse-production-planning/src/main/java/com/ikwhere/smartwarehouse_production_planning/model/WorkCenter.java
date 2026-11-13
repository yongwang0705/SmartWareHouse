package com.ikwhere.smartwarehouse_production_planning.model;

public record WorkCenter(Long id, String code, String name, Double capacityHoursPerDay, boolean active) {}
