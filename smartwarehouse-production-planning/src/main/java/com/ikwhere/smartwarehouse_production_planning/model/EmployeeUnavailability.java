package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalDateTime;

public record EmployeeUnavailability(
        Long id,
        Long employeeId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String reason
) {
}
