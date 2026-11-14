package com.ikwhere.smartwarehouse_production_planning.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AssignmentResponse(
        Long assignmentId,
        Long operationId,
        Long workCenterId,
        Long employeeId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BigDecimal allocatedHours,
        String status
) {
}
