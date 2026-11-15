package com.ikwhere.smartwarehouse_inventory.repository;

import com.ikwhere.smartwarehouse_inventory.dto.KanbanBinResponse;
import com.ikwhere.smartwarehouse_inventory.dto.WarehousePlotResponse;
import com.ikwhere.smartwarehouse_inventory.dto.WarehouseResponse;
import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.model.MaterialReservation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class InventoryRepository {

    private final JdbcTemplate jdbcTemplate;

    public InventoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Inventory> rowMapper = (rs, rowNum) ->
            new Inventory(
                    rs.getLong("id"),
                    rs.getLong("product_id"),
                    rs.getString("product_name"),
                    rs.getInt("quantity"),
                    rs.getInt("reserved_quantity"),
                    rs.getTimestamp("updated_at").toLocalDateTime(),
                    rs.getObject("is_product", Boolean.class)
            );

    public List<Inventory> findAll() {
        String sql = """
                SELECT id, product_id, product_name,
                       quantity, reserved_quantity, updated_at, is_product
                FROM inventory
                ORDER BY product_id
                """;

        return jdbcTemplate.query(sql, rowMapper);
    }

    public Optional<Inventory> findByProductId(Long productId) {
        String sql = """
                SELECT id, product_id, product_name,
                       quantity, reserved_quantity, updated_at, is_product
                FROM inventory
                WHERE product_id = ?
                """;

        return jdbcTemplate.query(sql, rowMapper, productId)
                .stream()
                .findFirst();
    }

    public boolean reserveStock(Long productId, Integer requestedQuantity) {
        String sql = """
                UPDATE inventory
                SET reserved_quantity = reserved_quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND quantity - reserved_quantity >= ?
                """;

        return jdbcTemplate.update(
                sql,
                requestedQuantity,
                productId,
                requestedQuantity
        ) == 1;
    }

    public boolean releaseStock(Long productId, Integer requestedQuantity) {
        String sql = """
                UPDATE inventory
                SET reserved_quantity = reserved_quantity - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND reserved_quantity >= ?
                """;

        return jdbcTemplate.update(
                sql,
                requestedQuantity,
                productId,
                requestedQuantity
        ) == 1;
    }

    public boolean addStock(Long productId, Integer quantity) {
        String sql = """
                UPDATE inventory
                SET quantity = quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                """;

        return jdbcTemplate.update(sql, quantity, productId) == 1;
    }

    public boolean consumeStock(Long productId, Integer quantity) {
        String sql = """
                UPDATE inventory
                SET quantity = quantity - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND quantity - reserved_quantity >= ?
                """;

        return jdbcTemplate.update(sql, quantity, productId, quantity) == 1;
    }

    public boolean fulfillReservedStock(String reference,
                                        Long productId,
                                        Integer quantity) {
        String sql = """
                UPDATE inventory
                SET quantity = quantity - ?,
                    reserved_quantity = reserved_quantity - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND reserved_quantity >= ?
                  AND quantity >= ?
                """;

        return jdbcTemplate.update(
                sql,
                quantity,
                quantity,
                productId,
                quantity,
                quantity
        ) == 1;
    }

    public int markReservationFulfilled(String reference, Long productId) {
        String sql = """
                UPDATE material_reservation
                SET status = 'FULFILLED'
                WHERE reservation_reference = ?
                  AND product_id = ?
                  AND status = 'RESERVED'
                """;

        return jdbcTemplate.update(sql, reference, productId);
    }

    public List<Inventory> findByProductIds(List<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return List.of();
        }

        String placeholders = String.join(
                ",",
                Collections.nCopies(productIds.size(), "?")
        );

        String sql = """
                SELECT id, product_id, product_name,
                       quantity, reserved_quantity, updated_at, is_product
                FROM inventory
                WHERE product_id IN (%s)
                ORDER BY product_id
                """.formatted(placeholders);

        return jdbcTemplate.query(sql, rowMapper, productIds.toArray());
    }

    public List<MaterialReservation> findReservations(String reference) {
        String sql = """
                SELECT id, reservation_reference, product_id, quantity,
                       status, created_at, released_at
                FROM material_reservation
                WHERE reservation_reference = ?
                ORDER BY product_id
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new MaterialReservation(
                rs.getLong("id"),
                rs.getString("reservation_reference"),
                rs.getLong("product_id"),
                rs.getInt("quantity"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getTimestamp("released_at") == null
                        ? null
                        : rs.getTimestamp("released_at").toLocalDateTime()
        ), reference);
    }

    public int insertReservation(String reference, Long productId, Integer quantity) {
        String sql = """
                INSERT INTO material_reservation
                    (reservation_reference, product_id, quantity, status)
                VALUES (?, ?, ?, 'RESERVED')
                ON CONFLICT (reservation_reference, product_id) DO NOTHING
                """;

        return jdbcTemplate.update(sql, reference, productId, quantity);
    }

    public int markReservationReleased(String reference, Long productId) {
        String sql = """
                UPDATE material_reservation
                SET status = 'RELEASED',
                    released_at = CURRENT_TIMESTAMP
                WHERE reservation_reference = ?
                  AND product_id = ?
                  AND status = 'RESERVED'
                """;

        return jdbcTemplate.update(sql, reference, productId);
    }

    public List<KanbanBinResponse> getKanbanBins() {
        String sql = """
                SELECT i.product_id, i.product_name, i.quantity,
                       i.reserved_quantity, i.min_stock_level, i.jit_enabled,
                       i.updated_at AS inventory_updated_at,
                       b.bin_id, b.capacity, b.min_stock_threshold,
                       b.last_triggered_at, b.updated_at AS bin_updated_at
                FROM inventory i
                LEFT JOIN kanban_bins b ON b.product_id = i.product_id
                WHERE i.jit_enabled = TRUE
                ORDER BY i.product_id
                """;

        LocalDateTime now = LocalDateTime.now();

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            int currentStock = rs.getInt("quantity");
            int reservedQuantity = rs.getInt("reserved_quantity");
            int availableQuantity = currentStock - reservedQuantity;

            Integer configuredThreshold =
                    rs.getObject("min_stock_threshold", Integer.class);
            int triggerLevel = configuredThreshold == null
                    ? rs.getInt("min_stock_level")
                    : configuredThreshold;

            Integer configuredCapacity =
                    rs.getObject("capacity", Integer.class);
            int capacity = configuredCapacity == null || configuredCapacity <= 0
                    ? Math.max(currentStock, Math.max(triggerLevel, 1))
                    : configuredCapacity;

            String binId = rs.getString("bin_id");
            if (binId == null) {
                binId = "AUTO-" + rs.getLong("product_id");
            }

            String status;
            if (availableQuantity <= 0) {
                status = "CRITICAL";
            } else if (availableQuantity <= triggerLevel) {
                status = "REORDER";
            } else if (availableQuantity > capacity) {
                status = "OVERSTOCK";
            } else if (availableQuantity * 2L <= capacity) {
                status = "LOW";
            } else {
                status = "HEALTHY";
            }

            double fillPercent = Math.min(
                    100.0,
                    Math.max(0.0, availableQuantity * 100.0 / capacity)
            );

            LocalDateTime inventoryUpdated =
                    toLocalDateTime(rs.getTimestamp("inventory_updated_at"));
            LocalDateTime binUpdated =
                    toLocalDateTime(rs.getTimestamp("bin_updated_at"));
            LocalDateTime lastTriggered =
                    toLocalDateTime(rs.getTimestamp("last_triggered_at"));

            return new KanbanBinResponse(
                    binId,
                    rs.getLong("product_id"),
                    rs.getString("product_name"),
                    capacity,
                    currentStock,
                    reservedQuantity,
                    availableQuantity,
                    triggerLevel,
                    rs.getBoolean("jit_enabled"),
                    status,
                    Math.round(fillPercent * 10.0) / 10.0,
                    ageInDays(inventoryUpdated, now),
                    ageInDays(
                            binUpdated == null ? inventoryUpdated : binUpdated,
                            now
                    ),
                    ageInDays(lastTriggered, now)
            );
        });
    }

    private static LocalDateTime toLocalDateTime(java.sql.Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private static Long ageInDays(LocalDateTime from, LocalDateTime now) {
        return from == null
                ? null
                : Math.max(0, ChronoUnit.DAYS.between(from, now));
    }

    public List<WarehouseResponse> getWarehouses() {
        String warehouseSql = """
                SELECT id, code, name, address, surface_area, status
                FROM warehouse
                WHERE status = 'ACTIVE'
                ORDER BY code
                """;

        String plotSql = """
                SELECT p.id, p.warehouse_id, p.code, p.name, p.plot_type,
                       p.surface_area, p.occupied_area,
                       p.product_id, p.capacity_units, p.occupied_units,
                       i.product_name, i.is_product
                FROM warehouse_plot p
                LEFT JOIN inventory i ON i.product_id = p.product_id
                ORDER BY p.warehouse_id, p.code
                """;

        Map<Long, List<WarehousePlotResponse>> plotsByWarehouse =
                new HashMap<>();

        jdbcTemplate.query(plotSql, rs -> {
            WarehousePlotResponse plot = mapPlot(rs);

            plotsByWarehouse
                    .computeIfAbsent(
                            rs.getLong("warehouse_id"),
                            key -> new ArrayList<>()
                    )
                    .add(plot);
        });

        return jdbcTemplate.query(warehouseSql, (rs, rowNum) -> {
            long id = rs.getLong("id");
            BigDecimal surfaceArea = rs.getBigDecimal("surface_area");
            List<WarehousePlotResponse> plots =
                    plotsByWarehouse.getOrDefault(id, List.of());

            BigDecimal allocatedArea = plots.stream()
                    .map(WarehousePlotResponse::surfaceArea)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal occupiedArea = plots.stream()
                    .map(WarehousePlotResponse::occupiedArea)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            int assignedPlots = (int) plots.stream()
                    .filter(plot -> plot.productId() != null)
                    .count();

            return new WarehouseResponse(
                    id,
                    rs.getString("code"),
                    rs.getString("name"),
                    rs.getString("address"),
                    surfaceArea,
                    allocatedArea,
                    occupiedArea,
                    percent(occupiedArea, surfaceArea),
                    plots.size(),
                    assignedPlots,
                    plots
            );
        });
    }

    private static double percent(BigDecimal value, BigDecimal total) {
        if (value == null || total == null || total.signum() == 0) {
            return 0.0;
        }

        return Math.round(
                value.doubleValue() / total.doubleValue() * 1000.0
        ) / 10.0;
    }

    public boolean warehouseExists(Long warehouseId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM warehouse
                WHERE id = ? AND status = 'ACTIVE'
                """, Integer.class, warehouseId);

        return count != null && count > 0;
    }

    public WarehousePlotResponse saveWarehousePlot(
            Long warehouseId,
            String code,
            String name,
            String plotType,
            BigDecimal surfaceArea,
            BigDecimal occupiedArea,
            Long productId,
            Integer capacityUnits,
            Integer occupiedUnits) {

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO warehouse_plot
                    (warehouse_id, code, name, plot_type, surface_area,
                     occupied_area, product_id, capacity_units, occupied_units)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                warehouseId,
                code,
                name,
                plotType,
                surfaceArea,
                occupiedArea,
                productId,
                capacityUnits,
                occupiedUnits
        );

        return findWarehousePlotById(id)
                .orElseThrow(() -> new IllegalStateException(
                        "Could not load the created plot: " + id
                ));
    }

    public boolean warehousePlotExists(Long warehouseId, Long plotId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM warehouse_plot
                WHERE id = ? AND warehouse_id = ?
                """, Integer.class, plotId, warehouseId);

        return count != null && count > 0;
    }

    public boolean warehousePlotCodeExists(Long warehouseId,
                                           String code,
                                           Long excludePlotId) {
        Integer count = excludePlotId == null
                ? jdbcTemplate.queryForObject("""
                        SELECT COUNT(*)
                        FROM warehouse_plot
                        WHERE warehouse_id = ? AND code = ?
                        """, Integer.class, warehouseId, code)
                : jdbcTemplate.queryForObject("""
                        SELECT COUNT(*)
                        FROM warehouse_plot
                        WHERE warehouse_id = ? AND code = ? AND id <> ?
                        """, Integer.class, warehouseId, code, excludePlotId);

        return count != null && count > 0;
    }

    public int updateWarehousePlot(
            Long warehouseId,
            Long plotId,
            String code,
            String name,
            String plotType,
            BigDecimal surfaceArea,
            BigDecimal occupiedArea,
            Long productId,
            Integer capacityUnits,
            Integer occupiedUnits) {

        return jdbcTemplate.update("""
                UPDATE warehouse_plot
                SET code = ?,
                    name = ?,
                    plot_type = ?,
                    surface_area = ?,
                    occupied_area = ?,
                    product_id = ?,
                    capacity_units = ?,
                    occupied_units = ?
                WHERE id = ? AND warehouse_id = ?
                """,
                code,
                name,
                plotType,
                surfaceArea,
                occupiedArea,
                productId,
                capacityUnits,
                occupiedUnits,
                plotId,
                warehouseId
        );
    }

    public int deleteWarehousePlot(Long warehouseId, Long plotId) {
        return jdbcTemplate.update("""
                DELETE FROM warehouse_plot
                WHERE id = ? AND warehouse_id = ?
                """, plotId, warehouseId);
    }

    /**
     * Removes units from the source plot. Moving the whole quantity clears the
     * assignment and releases the plotted area so the plot becomes EMPTY.
     */
    public int removePlotUnits(Long plotId,
                               int quantity,
                               boolean clearAssignment,
                               BigDecimal occupiedArea) {
        if (clearAssignment) {
            return jdbcTemplate.update("""
                    UPDATE warehouse_plot
                    SET product_id = NULL,
                        occupied_units = 0,
                        occupied_area = 0
                    WHERE id = ? AND occupied_units = ?
                    """, plotId, quantity);
        }

        return jdbcTemplate.update("""
                UPDATE warehouse_plot
                SET occupied_units = occupied_units - ?,
                    occupied_area = GREATEST(0, occupied_area - ?)
                WHERE id = ? AND occupied_units >= ?
                """, quantity, occupiedArea, plotId, quantity);
    }

    public int addPlotUnits(Long plotId,
                            Long productId,
                            int quantity,
                            boolean assignProduct,
                            BigDecimal occupiedArea) {
        if (assignProduct) {
            return jdbcTemplate.update("""
                    UPDATE warehouse_plot
                    SET product_id = ?,
                        occupied_units = occupied_units + ?,
                        occupied_area = LEAST(
                            surface_area,
                            occupied_area + ?
                        )
                    WHERE id = ?
                      AND (capacity_units = 0 OR occupied_units + ? <= capacity_units)
                    """, productId, quantity, occupiedArea, plotId, quantity);
        }

        return jdbcTemplate.update("""
                UPDATE warehouse_plot
                SET occupied_units = occupied_units + ?,
                    occupied_area = LEAST(
                        surface_area,
                        occupied_area + ?
                    )
                WHERE id = ?
                  AND (capacity_units = 0 OR occupied_units + ? <= capacity_units)
                """, quantity, occupiedArea, plotId, quantity);
    }

    public int totalPlotUnitsForProduct(Long productId) {
        Integer total = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(occupied_units), 0)
                FROM warehouse_plot
                WHERE product_id = ?
                """, Integer.class, productId);

        return total == null ? 0 : total;
    }

    public boolean orderStorageExists(Long orderId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM warehouse_order_storage
                WHERE order_id = ?
                """, Integer.class, orderId);

        return count != null && count > 0;
    }

    public List<OrderStorageRow> findOrderStorage(Long orderId) {
        return jdbcTemplate.query("""
                SELECT order_id, plot_id, product_id, quantity
                FROM warehouse_order_storage
                WHERE order_id = ?
                ORDER BY id
                """, (rs, rowNum) -> new OrderStorageRow(
                rs.getLong("order_id"),
                rs.getLong("plot_id"),
                rs.getLong("product_id"),
                rs.getInt("quantity")
        ), orderId);
    }

    public List<OrderStorageRow> findPlotOrderStorage(Long plotId) {
        return jdbcTemplate.query("""
                SELECT order_id, plot_id, product_id, quantity
                FROM warehouse_order_storage
                WHERE plot_id = ?
                ORDER BY id
                """, (rs, rowNum) -> new OrderStorageRow(
                rs.getLong("order_id"),
                rs.getLong("plot_id"),
                rs.getLong("product_id"),
                rs.getInt("quantity")
        ), plotId);
    }

    public int mergeOrderStorage(Long orderId,
                                 Long plotId,
                                 Long productId,
                                 Integer quantity) {
        return jdbcTemplate.update("""
                INSERT INTO warehouse_order_storage
                    (order_id, plot_id, product_id, quantity)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (order_id, plot_id, product_id)
                DO UPDATE SET quantity =
                    warehouse_order_storage.quantity + EXCLUDED.quantity
                """, orderId, plotId, productId, quantity);
    }

    public int decrementOrderStorage(Long orderId,
                                     Long plotId,
                                     Long productId,
                                     Integer quantity) {
        return jdbcTemplate.update("""
                UPDATE warehouse_order_storage
                SET quantity = quantity - ?
                WHERE order_id = ?
                  AND plot_id = ?
                  AND product_id = ?
                  AND quantity >= ?
                """, quantity, orderId, plotId, productId, quantity);
    }

    public int deleteOrderStorageRow(Long orderId,
                                     Long plotId,
                                     Long productId) {
        return jdbcTemplate.update("""
                DELETE FROM warehouse_order_storage
                WHERE order_id = ?
                  AND plot_id = ?
                  AND product_id = ?
                """, orderId, plotId, productId);
    }

    public int saveOrderStorage(Long orderId,
                                Long plotId,
                                Long productId,
                                Integer quantity) {
        return jdbcTemplate.update("""
                INSERT INTO warehouse_order_storage
                    (order_id, plot_id, product_id, quantity)
                VALUES (?, ?, ?, ?)
                """, orderId, plotId, productId, quantity);
    }

    public int deleteOrderStorage(Long orderId) {
        return jdbcTemplate.update("""
                DELETE FROM warehouse_order_storage
                WHERE order_id = ?
                """, orderId);
    }

    public record OrderStorageRow(
            Long orderId,
            Long plotId,
            Long productId,
            Integer quantity
    ) {
    }

    public Optional<WarehousePlotResponse> findWarehousePlotById(Long id) {
        String sql = """
                SELECT p.id, p.code, p.name, p.plot_type,
                       p.surface_area, p.occupied_area, p.product_id,
                       p.capacity_units, p.occupied_units,
                       i.product_name, i.is_product
                FROM warehouse_plot p
                LEFT JOIN inventory i ON i.product_id = p.product_id
                WHERE p.id = ?
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> mapPlot(rs), id)
                .stream()
                .findFirst();
    }

    private WarehousePlotResponse mapPlot(ResultSet rs) throws SQLException {
        BigDecimal surfaceArea = rs.getBigDecimal("surface_area");
        BigDecimal occupiedArea = rs.getBigDecimal("occupied_area");
        Long productId = rs.getObject("product_id", Long.class);
        int capacityUnits = rs.getInt("capacity_units");
        int occupiedUnits = rs.getInt("occupied_units");
        double occupancyPercent = percent(occupiedArea, surfaceArea);

        // Status follows the quantity in the plot: a plot is FULL only when
        // its unit capacity is reached. Occupied floor area is informational
        // and must not make a half-empty plot look full.
        String status;
        if (occupiedUnits <= 0) {
            status = "EMPTY";
        } else if (capacityUnits > 0 && occupiedUnits >= capacityUnits) {
            status = "FULL";
        } else {
            status = "OCCUPIED";
        }

        return new WarehousePlotResponse(
                rs.getLong("id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("plot_type"),
                surfaceArea,
                occupiedArea,
                occupancyPercent,
                productId,
                rs.getString("product_name"),
                rs.getObject("is_product", Boolean.class),
                capacityUnits,
                occupiedUnits,
                status
        );
    }

    public List<com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse> getBOM() {
        String sql = """
                SELECT b.parent_product_id, p1.product_name AS parent_product_name,
                       b.component_product_id, p2.product_name AS component_product_name,
                       b.quantity_required
                FROM product_bom b
                JOIN inventory p1 ON b.parent_product_id = p1.product_id
                JOIN inventory p2 ON b.component_product_id = p2.product_id
                ORDER BY b.parent_product_id, b.component_product_id
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) ->
                new com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse(
                        rs.getLong("parent_product_id"),
                        rs.getString("parent_product_name"),
                        rs.getLong("component_product_id"),
                        rs.getString("component_product_name"),
                        rs.getInt("quantity_required")
                )
        );
    }
}