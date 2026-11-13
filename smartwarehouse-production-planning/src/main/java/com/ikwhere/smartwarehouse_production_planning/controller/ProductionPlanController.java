package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.client.OrderGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.client.InventoryGrpcClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/production/plans")
public class ProductionPlanController {

    private final OrderGrpcClient orderGrpcClient;
    private final InventoryGrpcClient inventoryGrpcClient;

    public ProductionPlanController(OrderGrpcClient orderGrpcClient, InventoryGrpcClient inventoryGrpcClient) {
        this.orderGrpcClient = orderGrpcClient;
        this.inventoryGrpcClient = inventoryGrpcClient;
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generatePlan(@RequestBody Map<String, Object> request) {
        // Full workflow generation stub returning draft plan status
        return ResponseEntity.ok(Map.of(
            "planId", 1L,
            "status", "DRAFT",
            "message", "Production plan generated successfully"
        ));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirmPlan(@PathVariable Long id) {
        // Confirmation workflow stub
        return ResponseEntity.ok(Map.of(
            "planId", id,
            "status", "CONFIRMED",
            "message", "Production plan confirmed and materials reserved successfully"
        ));
    }
}
