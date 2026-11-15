package com.ikwhere.smartwarehouse_production_planning.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LineAssignmentResponse(
        Long assignmentId,
        Long lineId,
        String lineCode,
        String lineName,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BigDecimal allocatedHours
) {
}
