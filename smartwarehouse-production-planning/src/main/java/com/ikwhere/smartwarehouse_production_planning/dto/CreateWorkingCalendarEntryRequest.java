package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record CreateWorkingCalendarEntryRequest(
        @NotNull LocalDate workDate,
        boolean workingDay,
        LocalTime startTime,
        LocalTime endTime,
        String description
) {
}
