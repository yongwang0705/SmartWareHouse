package com.ikwhere.smartwarehouse_production_planning.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ResourceAssignment(
        Long id,
        Long productionTaskId,
        Long operationId,
        Long workCenterId,
        Long employeeId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BigDecimal allocatedHours,
        String status
) {
}
