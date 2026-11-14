package com.ikwhere.smartwarehouse_inventory.model;

import java.time.LocalDateTime;

public record MaterialReservation(
        Long id,
        String reservationReference,
        Long productId,
        Integer quantity,
        String status,
        LocalDateTime createdAt,
        LocalDateTime releasedAt
) {
}
