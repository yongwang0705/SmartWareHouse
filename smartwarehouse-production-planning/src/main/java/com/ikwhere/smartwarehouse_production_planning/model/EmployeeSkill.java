package com.ikwhere.smartwarehouse_production_planning.model;

public record EmployeeSkill(
    Long id,
    Long employeeId,
    String skillCode,
    String proficiency
) {}
