package com.ikwhere.smartwarehouse_inventory.controller;

import com.ikwhere.smartwarehouse_inventory.dto.CreateWarehousePlotRequest;
import com.ikwhere.smartwarehouse_inventory.dto.MovePlotItemsRequest;
import com.ikwhere.smartwarehouse_inventory.dto.MovePlotItemsResponse;
import com.ikwhere.smartwarehouse_inventory.dto.WarehousePlotResponse;
import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.service.InventoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public ResponseEntity<List<Inventory>> getAllInventory() {
        return ResponseEntity.ok(inventoryService.getAllInventory());
    }

    @GetMapping("/bom")
    public ResponseEntity<List<com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse>> getBOM() {
        return ResponseEntity.ok(inventoryService.getBOM());
    }

    @GetMapping("/kanban")
    public ResponseEntity<List<com.ikwhere.smartwarehouse_inventory.dto.KanbanBinResponse>> getKanbanBins() {
        return ResponseEntity.ok(inventoryService.getKanbanBins());
    }

    @GetMapping("/warehouses")
    public ResponseEntity<List<com.ikwhere.smartwarehouse_inventory.dto.WarehouseResponse>> getWarehouses() {
        return ResponseEntity.ok(inventoryService.getWarehouses());
    }

    @PostMapping("/warehouses/{warehouseId}/plots")
    public ResponseEntity<WarehousePlotResponse> createWarehousePlot(
            @PathVariable Long warehouseId,
            @Valid @RequestBody CreateWarehousePlotRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createWarehousePlot(warehouseId, request));
    }

    @PutMapping("/warehouses/{warehouseId}/plots/{plotId}")
    public ResponseEntity<WarehousePlotResponse> updateWarehousePlot(
            @PathVariable Long warehouseId,
            @PathVariable Long plotId,
            @Valid @RequestBody CreateWarehousePlotRequest request) {

        return ResponseEntity.ok(
                inventoryService.updateWarehousePlot(
                        warehouseId, plotId, request
                )
        );
    }

    @DeleteMapping("/warehouses/{warehouseId}/plots/{plotId}")
    public ResponseEntity<Void> deleteWarehousePlot(
            @PathVariable Long warehouseId,
            @PathVariable Long plotId) {

        inventoryService.deleteWarehousePlot(warehouseId, plotId);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/warehouses/{warehouseId}/plots/{plotId}/move")
    public ResponseEntity<MovePlotItemsResponse> moveWarehousePlotItems(
            @PathVariable Long warehouseId,
            @PathVariable Long plotId,
            @Valid @RequestBody MovePlotItemsRequest request) {

        return ResponseEntity.ok(
                inventoryService.moveWarehousePlotItems(
                        warehouseId, plotId, request
                )
        );
    }

    @GetMapping("/{productId}")
    public ResponseEntity<Inventory> getInventoryByProductId(
            @PathVariable Long productId) {
        return ResponseEntity.ok(
                inventoryService.getInventoryByProductId(productId)
        );
    }

    @PostMapping("/{productId}/reserve")
    public ResponseEntity<String> reserveStock(
            @PathVariable Long productId,
            @RequestParam Integer quantity) {

        inventoryService.reserveStock(productId, quantity);

        return ResponseEntity.ok("Stock reserved successfully");
    }

    @PostMapping("/{productId}/release")
    public ResponseEntity<String> releaseStock(
            @PathVariable Long productId,
            @RequestParam Integer quantity) {

        inventoryService.releaseStock(productId, quantity);

        return ResponseEntity.ok("Stock released successfully");
    }
}
