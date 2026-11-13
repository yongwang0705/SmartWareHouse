package com.ikwhere.smartwarehouse_production_planning.model;

import java.time.LocalDateTime;

public record ProductBom(
    Long id,
    Long productId,
    Long materialProductId,
    Integer quantityPerUnit,
    boolean active,
    LocalDateTime createdAt
) {}
