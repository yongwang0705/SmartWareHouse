package com.ikwhere.smartwarehouse_production_planning.model;

import java.math.BigDecimal;

public record RoutingOperation(
    Long id,
    Long routingId,
    Integer sequenceNumber,
    String operationName,
    Long workCenterId,
    String skillCode,
    BigDecimal minutesPerUnit,
    BigDecimal setupMinutes
) {}
