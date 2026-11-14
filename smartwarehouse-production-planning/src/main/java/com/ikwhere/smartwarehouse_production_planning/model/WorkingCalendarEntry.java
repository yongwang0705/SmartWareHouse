package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalDate;
import java.time.LocalTime;

public record WorkingCalendarEntry(
        Long id,
        LocalDate workDate,
        boolean workingDay,
        LocalTime startTime,
        LocalTime endTime,
        String description
) {
}
