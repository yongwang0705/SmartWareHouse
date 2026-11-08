package com.ikwhere.smartwarehouse_inventory.controller;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.service.InventoryService;
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
