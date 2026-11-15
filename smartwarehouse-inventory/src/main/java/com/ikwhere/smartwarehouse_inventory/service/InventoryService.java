package com.ikwhere.smartwarehouse_inventory.service;

import com.ikwhere.smartwarehouse_inventory.dto.CreateWarehousePlotRequest;
import com.ikwhere.smartwarehouse_inventory.dto.MovePlotItemsRequest;
import com.ikwhere.smartwarehouse_inventory.dto.MovePlotItemsResponse;
import com.ikwhere.smartwarehouse_inventory.dto.WarehousePlotResponse;
import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.model.MaterialReservation;
import com.ikwhere.smartwarehouse_inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

@Service
public class InventoryService {

    private static final Set<String> PLOT_TYPES =
            Set.of("RACK", "BIN", "FLOOR", "BULK", "COLD");

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public record BatchOperationResult(boolean success, String message) {
    }

    public record OrderStorageAllocation(
            Long plotId,
            Long productId,
            Integer quantity
    ) {
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
    public List<com.ikwhere.smartwarehouse_inventory.dto.KanbanBinResponse> getKanbanBins() {
        return inventoryRepository.getKanbanBins();
    }

    @Transactional(readOnly = true)
    public List<com.ikwhere.smartwarehouse_inventory.dto.WarehouseResponse> getWarehouses() {
        return inventoryRepository.getWarehouses();
    }

    @Transactional
    public WarehousePlotResponse createWarehousePlot(
            Long warehouseId,
            CreateWarehousePlotRequest request) {

        if (!inventoryRepository.warehouseExists(warehouseId)) {
            throw new IllegalArgumentException(
                    "Warehouse not found: " + warehouseId
            );
        }

        ValidatedPlot plot = validatePlotRequest(request);

        if (inventoryRepository.warehousePlotCodeExists(
                warehouseId, plot.code(), null)) {
            throw new IllegalStateException(
                    "A plot with this code already exists in this warehouse"
            );
        }

        return inventoryRepository.saveWarehousePlot(
                warehouseId,
                plot.code(),
                plot.name(),
                plot.plotType(),
                plot.surfaceArea(),
                plot.occupiedArea(),
                plot.productId(),
                plot.capacityUnits(),
                plot.occupiedUnits()
        );
    }

    @Transactional
    public WarehousePlotResponse updateWarehousePlot(
            Long warehouseId,
            Long plotId,
            CreateWarehousePlotRequest request) {

        if (!inventoryRepository.warehouseExists(warehouseId)) {
            throw new IllegalArgumentException(
                    "Warehouse not found: " + warehouseId
            );
        }

        if (!inventoryRepository.warehousePlotExists(warehouseId, plotId)) {
            throw new IllegalArgumentException(
                    "Plot not found in this warehouse: " + plotId
            );
        }

        ValidatedPlot plot = validatePlotRequest(request);

        if (inventoryRepository.warehousePlotCodeExists(
                warehouseId, plot.code(), plotId)) {
            throw new IllegalStateException(
                    "A plot with this code already exists in this warehouse"
            );
        }

        int updated = inventoryRepository.updateWarehousePlot(
                warehouseId,
                plotId,
                plot.code(),
                plot.name(),
                plot.plotType(),
                plot.surfaceArea(),
                plot.occupiedArea(),
                plot.productId(),
                plot.capacityUnits(),
                plot.occupiedUnits()
        );

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not update plot: " + plotId
            );
        }

        return inventoryRepository.findWarehousePlotById(plotId)
                .orElseThrow(() -> new IllegalStateException(
                        "Could not load the updated plot: " + plotId
                ));
    }

    @Transactional
    public void deleteWarehousePlot(Long warehouseId, Long plotId) {
        if (!inventoryRepository.warehouseExists(warehouseId)) {
            throw new IllegalArgumentException(
                    "Warehouse not found: " + warehouseId
            );
        }

        if (!inventoryRepository.warehousePlotExists(warehouseId, plotId)) {
            throw new IllegalArgumentException(
                    "Plot not found in this warehouse: " + plotId
            );
        }

        int deleted = inventoryRepository.deleteWarehousePlot(
                warehouseId,
                plotId
        );

        if (deleted != 1) {
            throw new IllegalStateException(
                    "Could not delete plot: " + plotId
            );
        }
    }

    /**
     * Moves a quantity of the item assigned to the source plot into another
     * plot in the same warehouse. Destination plots must be empty or already
     * assigned to the same item, and must have enough remaining capacity.
     */
    @Transactional
    public MovePlotItemsResponse moveWarehousePlotItems(
            Long warehouseId,
            Long sourcePlotId,
            MovePlotItemsRequest request) {

        if (!inventoryRepository.warehouseExists(warehouseId)) {
            throw new IllegalArgumentException(
                    "Warehouse not found: " + warehouseId
            );
        }

        Long destinationPlotId = request.destinationPlotId();

        if (sourcePlotId.equals(destinationPlotId)) {
            throw new IllegalStateException(
                    "Source and destination plots must be different"
            );
        }

        if (!inventoryRepository.warehousePlotExists(
                warehouseId, sourcePlotId)) {
            throw new IllegalArgumentException(
                    "Source plot not found in this warehouse: "
                            + sourcePlotId
            );
        }

        if (!inventoryRepository.warehousePlotExists(
                warehouseId, destinationPlotId)) {
            throw new IllegalArgumentException(
                    "Destination plot not found in this warehouse: "
                            + destinationPlotId
            );
        }

        WarehousePlotResponse source = inventoryRepository
                .findWarehousePlotById(sourcePlotId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Source plot not found: " + sourcePlotId
                ));
        WarehousePlotResponse destination = inventoryRepository
                .findWarehousePlotById(destinationPlotId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Destination plot not found: " + destinationPlotId
                ));

        if (source.productId() == null) {
            throw new IllegalStateException(
                    "Source plot has no assigned product or material"
            );
        }

        int quantity = request.quantity();

        if (source.occupiedUnits() <= 0) {
            throw new IllegalStateException(
                    "Source plot has no units to move"
            );
        }

        if (quantity > source.occupiedUnits()) {
            throw new IllegalStateException(
                    "Cannot move more units than the source plot holds"
            );
        }

        if (destination.productId() != null
                && !destination.productId().equals(source.productId())) {
            throw new IllegalStateException(
                    "Destination plot already holds a different item"
            );
        }

        if (destination.productId() == null
                && destination.occupiedUnits() > 0) {
            throw new IllegalStateException(
                    "Destination plot is occupied but has no assigned item"
            );
        }

        if (destination.capacityUnits() > 0
                && destination.occupiedUnits() + quantity
                > destination.capacityUnits()) {
            throw new IllegalStateException(
                    "Destination plot does not have enough capacity"
            );
        }

        boolean clearSource = quantity == source.occupiedUnits();
        boolean assignDestination = destination.productId() == null;

        // Keep the space metric consistent with the quantity moved. The source
        // plot's area-per-unit density is used as the estimate.
        BigDecimal movedArea = source.occupiedArea() == null
                ? BigDecimal.ZERO
                : source.occupiedArea();
        if (!clearSource) {
            movedArea = movedArea
                    .multiply(BigDecimal.valueOf(quantity))
                    .divide(
                            BigDecimal.valueOf(source.occupiedUnits()),
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        int removed = inventoryRepository.removePlotUnits(
                sourcePlotId,
                quantity,
                clearSource,
                movedArea
        );
        int added = inventoryRepository.addPlotUnits(
                destinationPlotId,
                source.productId(),
                quantity,
                assignDestination,
                movedArea
        );

        if (removed != 1 || added != 1) {
            throw new IllegalStateException(
                    "Could not move units between plots"
            );
        }

        moveOrderStorage(
                sourcePlotId,
                destinationPlotId,
                source.productId(),
                quantity
        );

        return new MovePlotItemsResponse(
                inventoryRepository.findWarehousePlotById(sourcePlotId)
                        .orElseThrow(),
                inventoryRepository.findWarehousePlotById(destinationPlotId)
                        .orElseThrow()
        );
    }

    /**
     * Places an order's products into warehouse plots. The caller is
     * responsible for sending quantities that cover the order; this method
     * validates plot compatibility and capacity and records the allocation.
     */
    @Transactional
    public BatchOperationResult storeOrderStorage(
            Long orderId,
            List<OrderStorageAllocation> allocations) {

        if (allocations == null || allocations.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one plot allocation is required"
            );
        }

        if (inventoryRepository.orderStorageExists(orderId)) {
            throw new IllegalStateException(
                    "Order " + orderId + " is already stored in the warehouse"
            );
        }

        Map<Long, Long> productByPlot = new LinkedHashMap<>();
        Map<Long, Integer> quantityByPlot = new LinkedHashMap<>();

        for (OrderStorageAllocation allocation : allocations) {
            if (allocation.plotId() == null || allocation.productId() == null) {
                throw new IllegalArgumentException(
                        "Plot and product are required for every allocation"
                );
            }

            validateQuantity(allocation.quantity());

            productByPlot.merge(
                    allocation.plotId(),
                    allocation.productId(),
                    (existing, incoming) -> {
                        if (!existing.equals(incoming)) {
                            throw new IllegalStateException(
                                    "A plot can only store one item at a time"
                            );
                        }
                        return existing;
                    }
            );
            quantityByPlot.merge(
                    allocation.plotId(),
                    allocation.quantity(),
                    Integer::sum
            );
        }

        Map<Long, Integer> requestedByProduct = new LinkedHashMap<>();
        for (Map.Entry<Long, Long> entry : productByPlot.entrySet()) {
            requestedByProduct.merge(
                    entry.getValue(),
                    quantityByPlot.get(entry.getKey()),
                    Integer::sum
            );
        }

        // Plot occupancy is a breakdown of physical inventory, so the total
        // placed in plots must never exceed the product's inventory quantity.
        for (Map.Entry<Long, Integer> entry : requestedByProduct.entrySet()) {
            Long productId = entry.getKey();
            int requested = entry.getValue();
            Inventory inventory = getInventoryByProductId(productId);
            int plotted = inventoryRepository.totalPlotUnitsForProduct(productId);

            if (plotted + requested > inventory.quantity()) {
                throw new IllegalStateException(
                        "Cannot store " + requested + " units of "
                                + inventory.productName() + ": inventory has "
                                + inventory.quantity() + " units and plots already hold "
                                + plotted
                );
            }
        }

        for (Map.Entry<Long, Long> entry : productByPlot.entrySet()) {
            Long plotId = entry.getKey();
            Long productId = entry.getValue();
            int quantity = quantityByPlot.get(plotId);

            WarehousePlotResponse plot = inventoryRepository
                    .findWarehousePlotById(plotId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Plot not found: " + plotId
                    ));

            if (plot.productId() != null
                    && !plot.productId().equals(productId)) {
                throw new IllegalStateException(
                        "Plot " + plot.code()
                                + " already holds a different item"
                );
            }

            if (plot.productId() == null && plot.occupiedUnits() > 0) {
                throw new IllegalStateException(
                        "Plot " + plot.code()
                                + " is occupied but has no assigned item"
                );
            }

            if (plot.capacityUnits() > 0
                    && plot.occupiedUnits() + quantity
                    > plot.capacityUnits()) {
                throw new IllegalStateException(
                        "Plot " + plot.code() + " does not have enough capacity"
                );
            }

            getInventoryByProductId(productId);

            boolean assignProduct = plot.productId() == null;
            BigDecimal area = areaForQuantity(plot, quantity);

            int added = inventoryRepository.addPlotUnits(
                    plotId,
                    productId,
                    quantity,
                    assignProduct,
                    area
            );

            if (added != 1) {
                throw new IllegalStateException(
                        "Could not place stock in plot " + plot.code()
                );
            }

            inventoryRepository.saveOrderStorage(
                    orderId,
                    plotId,
                    productId,
                    quantity
            );
        }

        return new BatchOperationResult(
                true,
                "Order stored in warehouse"
        );
    }

    @Transactional
    public BatchOperationResult releaseOrderStorage(Long orderId) {
        releaseOrderStorageInternal(orderId);
        return new BatchOperationResult(
                true,
                "Order storage released"
        );
    }

    /**
     * Ships an order that was stored in warehouse plots. Inventory and plot
     * allocations are changed in one transaction.
     */
    @Transactional
    public BatchOperationResult shipStoredOrder(
            Long orderId,
            String reference,
            Map<Long, Integer> quantities) {

        BatchOperationResult fulfillment =
                doFulfillMaterials(reference, quantities);

        if (!fulfillment.success()) {
            throw new IllegalStateException(fulfillment.message());
        }

        releaseOrderStorageInternal(orderId);

        return new BatchOperationResult(
                true,
                "Order shipped from warehouse"
        );
    }

    private void releaseOrderStorageInternal(Long orderId) {
        List<InventoryRepository.OrderStorageRow> allocations =
                inventoryRepository.findOrderStorage(orderId);

        for (InventoryRepository.OrderStorageRow allocation : allocations) {
            int quantity = allocation.quantity();

            WarehousePlotResponse plot = inventoryRepository
                    .findWarehousePlotById(allocation.plotId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Stored plot no longer exists: "
                                    + allocation.plotId()
                    ));

            if (quantity > plot.occupiedUnits()) {
                throw new IllegalStateException(
                        "Plot " + plot.code()
                                + " holds fewer units than its order allocation"
                );
            }

            boolean clearProduct = quantity == plot.occupiedUnits();
            BigDecimal area = areaForQuantity(plot, quantity);

            int removed = inventoryRepository.removePlotUnits(
                    allocation.plotId(),
                    quantity,
                    clearProduct,
                    area
            );

            if (removed != 1) {
                throw new IllegalStateException(
                        "Could not release stock from plot " + plot.code()
                );
            }
        }

        inventoryRepository.deleteOrderStorage(orderId);
    }

    /**
     * Keeps order storage allocations aligned with a plot-to-plot move. Units
     * are consumed from the source plot's allocations in creation order; the
     * remainder (if any) was general stock rather than order-allocated stock.
     */
    private void moveOrderStorage(Long sourcePlotId,
                                  Long destinationPlotId,
                                  Long productId,
                                  int quantity) {
        int remaining = quantity;

        for (InventoryRepository.OrderStorageRow allocation
                : inventoryRepository.findPlotOrderStorage(sourcePlotId)) {
            if (remaining <= 0) {
                break;
            }

            if (!productId.equals(allocation.productId())) {
                continue;
            }

            int moved = Math.min(remaining, allocation.quantity());

            if (moved == allocation.quantity()) {
                inventoryRepository.deleteOrderStorageRow(
                        allocation.orderId(),
                        sourcePlotId,
                        productId
                );
            } else if (inventoryRepository.decrementOrderStorage(
                    allocation.orderId(),
                    sourcePlotId,
                    productId,
                    moved
            ) != 1) {
                throw new IllegalStateException(
                        "Could not update order storage during plot move"
                );
            }

            inventoryRepository.mergeOrderStorage(
                    allocation.orderId(),
                    destinationPlotId,
                    productId,
                    moved
            );

            remaining -= moved;
        }
    }

    private BigDecimal areaForQuantity(WarehousePlotResponse plot,
                                       int quantity) {
        if (plot.occupiedUnits() > 0
                && plot.occupiedArea() != null
                && plot.occupiedArea().signum() > 0) {
            return plot.occupiedArea()
                    .multiply(BigDecimal.valueOf(quantity))
                    .divide(
                            BigDecimal.valueOf(plot.occupiedUnits()),
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        if (plot.capacityUnits() > 0) {
            return plot.surfaceArea()
                    .multiply(BigDecimal.valueOf(quantity))
                    .divide(
                            BigDecimal.valueOf(plot.capacityUnits()),
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return BigDecimal.ZERO;
    }

    private ValidatedPlot validatePlotRequest(
            CreateWarehousePlotRequest request) {

        String plotType = request.plotType() == null
                ? "RACK"
                : request.plotType().trim().toUpperCase();

        if (!PLOT_TYPES.contains(plotType)) {
            throw new IllegalStateException(
                    "Unsupported plot type: " + request.plotType()
            );
        }

        BigDecimal surfaceArea = request.surfaceArea();
        BigDecimal occupiedArea = request.occupiedArea() == null
                ? BigDecimal.ZERO
                : request.occupiedArea();

        if (occupiedArea.compareTo(surfaceArea) > 0) {
            throw new IllegalStateException(
                    "Occupied area cannot exceed surface area"
            );
        }

        int capacityUnits = request.capacityUnits() == null
                ? 0
                : request.capacityUnits();
        int occupiedUnits = request.occupiedUnits() == null
                ? 0
                : request.occupiedUnits();

        if (capacityUnits > 0 && occupiedUnits > capacityUnits) {
            throw new IllegalStateException(
                    "Occupied units cannot exceed capacity"
            );
        }

        if (request.productId() != null) {
            inventoryRepository.findByProductId(request.productId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + request.productId()
                    ));
        }

        return new ValidatedPlot(
                request.code().trim().toUpperCase(),
                request.name().trim(),
                plotType,
                surfaceArea,
                occupiedArea,
                request.productId(),
                capacityUnits,
                occupiedUnits
        );
    }

    private record ValidatedPlot(
            String code,
            String name,
            String plotType,
            BigDecimal surfaceArea,
            BigDecimal occupiedArea,
            Long productId,
            int capacityUnits,
            int occupiedUnits
    ) {
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

    /**
     * Adds finished goods to inventory, used when a production task completes.
     */
    @Transactional
    public void addStock(Long productId, Integer quantity) {
        validateQuantity(quantity);
        getInventoryByProductId(productId);

        if (!inventoryRepository.addStock(productId, quantity)) {
            throw new IllegalStateException(
                    "Could not add stock for product: " + productId
            );
        }
    }

    /**
     * Ships an order. If the reference has reserved materials, the reservation
     * is consumed. Otherwise the stock is consumed directly (orders that were
     * produced to order have no prior reservation).
     */
    @Transactional
    public BatchOperationResult fulfillMaterials(String reference,
                                                 Map<Long, Integer> quantities) {
        return doFulfillMaterials(reference, quantities);
    }

    private BatchOperationResult doFulfillMaterials(
            String reference,
            Map<Long, Integer> quantities) {

        Map<Long, Integer> requested = normalizeQuantities(quantities);

        List<MaterialReservation> existing =
                reference == null || reference.isBlank()
                        ? List.of()
                        : inventoryRepository.findReservations(reference);

        if (!existing.isEmpty()) {
            Map<Long, MaterialReservation> byProduct = new HashMap<>();
            for (MaterialReservation reservation : existing) {
                byProduct.put(reservation.productId(), reservation);
            }

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

                if (!"RESERVED".equals(reservation.status())) {
                    return new BatchOperationResult(
                            false,
                            "Reservation " + reference + " is "
                                    + reservation.status()
                    );
                }
            }

            for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
                if (!inventoryRepository.fulfillReservedStock(
                        reference,
                        entry.getKey(),
                        entry.getValue()
                )) {
                    throw new IllegalStateException(
                            "Insufficient reserved stock for product: "
                                    + entry.getKey()
                    );
                }

                inventoryRepository.markReservationFulfilled(
                        reference,
                        entry.getKey()
                );
            }

            return new BatchOperationResult(
                    true,
                    "Materials fulfilled successfully"
            );
        }

        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            getInventoryByProductId(entry.getKey());

            if (!inventoryRepository.consumeStock(
                    entry.getKey(),
                    entry.getValue()
            )) {
                throw new IllegalStateException(
                        "Insufficient available stock for product: "
                                + entry.getKey()
                );
            }
        }

        return new BatchOperationResult(true, "Stock consumed successfully");
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
