package com.ikwhere.smartwarehouse_order_service.controller;


import com.ikwhere.smartwarehouse_order_service.dto.CreateOrderRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderResponse;
import com.ikwhere.smartwarehouse_order_service.model.Order;
import com.ikwhere.smartwarehouse_order_service.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<OrderResponse> createOrder(
            @Valid @RequestBody CreateOrderRequest request) {

        OrderResponse response = orderService.createOrder(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public ResponseEntity<?> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrderById(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(orderService.getOrderById(id));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> cancelOrder(
            @PathVariable Long id
    ) {
        orderService.cancelOrder(id);

        return ResponseEntity.ok(
                Map.of("message", "Order cancelled successfully")
        );
    }
}