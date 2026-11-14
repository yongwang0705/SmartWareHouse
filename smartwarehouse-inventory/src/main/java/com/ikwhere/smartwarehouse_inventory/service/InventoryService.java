package com.ikwhere.smartwarehouse_inventory.service;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.model.MaterialReservation;
import com.ikwhere.smartwarehouse_inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public record BatchOperationResult(boolean success, String message) {
    }

    @Transactional(readOnly = true)
    public List<Inventory> getAllInventory() {
        return inventoryRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse> getBOM() {
        return inventoryRepository.getBOM();
    }

    @Transactional(readOnly = true)
    public Inventory getInventoryByProductId(Long productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Inventory not found for product: " + productId
                        ));
    }

    @Transactional(readOnly = true)
    public List<Inventory> getInventoryBatch(List<Long> productIds) {
        return inventoryRepository.findByProductIds(productIds);
    }

    @Transactional
    public void reserveStock(Long productId, Integer quantity) {
        validateQuantity(quantity);

        getInventoryByProductId(productId);

        boolean reserved = inventoryRepository.reserveStock(productId, quantity);

        if (!reserved) {
            throw new IllegalStateException(
                    "Insufficient available stock for product: " + productId
            );
        }
    }

    @Transactional
    public void releaseStock(Long productId, Integer quantity) {
        validateQuantity(quantity);

        getInventoryByProductId(productId);

        boolean released = inventoryRepository.releaseStock(productId, quantity);

        if (!released) {
            throw new IllegalStateException(
                    "Cannot release more stock than currently reserved for product: "
                            + productId
            );
        }
    }

    /**
     * Reserves every material in the batch or none of them. The operation is
     * idempotent for the supplied reservation reference: repeating the same
     * request does not reserve stock twice.
     */
    @Transactional
    public BatchOperationResult reserveMaterials(String reference,
                                                 Map<Long, Integer> quantities) {
        validateReference(reference);
        Map<Long, Integer> requested = normalizeQuantities(quantities);

        List<MaterialReservation> existing =
                inventoryRepository.findReservations(reference);

        if (!existing.isEmpty()) {
            return replayReservation(reference, requested, existing);
        }

        // Sorted processing keeps lock acquisition order deterministic and
        // reduces the chance of deadlocks between concurrent reservations.
        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            Long productId = entry.getKey();
            Integer quantity = entry.getValue();

            getInventoryByProductId(productId);

            boolean reserved = inventoryRepository.reserveStock(productId, quantity);

            if (!reserved) {
                // Roll back every reservation made earlier in this batch.
                throw new IllegalStateException(
                        "Insufficient available stock for product: " + productId
                );
            }

            int inserted = inventoryRepository.insertReservation(
                    reference,
                    productId,
                    quantity
            );

            if (inserted != 1) {
                throw new IllegalStateException(
                        "Reservation reference was already used: " + reference
                );
            }
        }

        return new BatchOperationResult(true, "Materials reserved successfully");
    }

    /**
     * Releases the listed materials for a reservation reference. Repeating a
     * release request is safe; already-released materials are skipped.
     */
    @Transactional
    public BatchOperationResult releaseMaterials(String reference,
                                                 Map<Long, Integer> quantities) {
        validateReference(reference);
        Map<Long, Integer> requested = normalizeQuantities(quantities);

        List<MaterialReservation> existing =
                inventoryRepository.findReservations(reference);

        if (existing.isEmpty()) {
            return new BatchOperationResult(
                    false,
                    "Unknown reservation reference: " + reference
            );
        }

        Map<Long, MaterialReservation> byProduct = new HashMap<>();
        for (MaterialReservation reservation : existing) {
            byProduct.put(reservation.productId(), reservation);
        }

        // Validate the complete request before changing any stock so a bad
        // item cannot leave a partially released reservation behind.
        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            MaterialReservation reservation = byProduct.get(entry.getKey());

            if (reservation == null) {
                return new BatchOperationResult(
                        false,
                        "Product " + entry.getKey()
                                + " is not part of reservation " + reference
                );
            }

            if (!reservation.quantity().equals(entry.getValue())) {
                return new BatchOperationResult(
                        false,
                        "Quantity mismatch for product " + entry.getKey()
                                + " in reservation " + reference
                );
            }
        }

        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            MaterialReservation reservation = byProduct.get(entry.getKey());

            if (!"RESERVED".equals(reservation.status())) {
                continue;
            }

            // Claim the reservation row first. Only the transaction that moves
            // it from RESERVED to RELEASED may decrement inventory, so two
            // concurrent release requests cannot release the same stock twice.
            int claimed = inventoryRepository.markReservationReleased(
                    reference,
                    entry.getKey()
            );

            if (claimed == 0) {
                continue;
            }

            boolean released = inventoryRepository.releaseStock(
                    entry.getKey(),
                    entry.getValue()
            );

            if (!released) {
                throw new IllegalStateException(
                        "Cannot release reservation " + reference
                                + " for product " + entry.getKey()
                );
            }
        }

        return new BatchOperationResult(true, "Materials released successfully");
    }

    private BatchOperationResult replayReservation(String reference,
                                                   Map<Long, Integer> requested,
                                                   List<MaterialReservation> existing) {
        if (existing.size() != requested.size()) {
            return new BatchOperationResult(
                    false,
                    "Reservation reference " + reference
                            + " was already used with different materials"
            );
        }

        for (MaterialReservation reservation : existing) {
            Integer quantity = requested.get(reservation.productId());

            if (quantity == null || !quantity.equals(reservation.quantity())) {
                return new BatchOperationResult(
                        false,
                        "Reservation reference " + reference
                                + " was already used with different materials"
                );
            }

            if (!"RESERVED".equals(reservation.status())) {
                return new BatchOperationResult(
                        false,
                        "Reservation " + reference + " has already been released"
                );
            }
        }

        return new BatchOperationResult(true, "Materials already reserved");
    }

    private Map<Long, Integer> normalizeQuantities(Map<Long, Integer> quantities) {
        if (quantities == null || quantities.isEmpty()) {
            throw new IllegalArgumentException("At least one material is required");
        }

        Map<Long, Integer> normalized = new TreeMap<>();
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            if (entry.getKey() == null) {
                throw new IllegalArgumentException("Material product id is required");
            }
            Integer quantity = entry.getValue();
            validateQuantity(quantity);
            normalized.merge(entry.getKey(), quantity, Integer::sum);
        }

        return normalized;
    }

    private void validateReference(String reference) {
        if (reference == null || reference.isBlank()) {
            throw new IllegalArgumentException("Reservation reference is required");
        }
        if (reference.length() > 100) {
            throw new IllegalArgumentException(
                    "Reservation reference must be at most 100 characters"
            );
        }
    }

    private void validateQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException(
                    "Quantity must be greater than zero"
            );
        }
    }
}
