package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalTime;

public record EmployeeShift(
    Long id,
    Long employeeId,
    LocalTime shiftStart,
    LocalTime shiftEnd,
    String workingDays,
    boolean active
) {}
