package com.ikwhere.smartwarehouse_order_service.service;

import com.ikwhere.smartwarehouse_order_service.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_order_service.dto.CreateOrderRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemResponse;
import com.ikwhere.smartwarehouse_order_service.dto.OrderResponse;
import com.ikwhere.smartwarehouse_order_service.model.Order;
import com.ikwhere.smartwarehouse_order_service.model.OrderItem;
import com.ikwhere.smartwarehouse_order_service.repository.OrderItemRepository;
import com.ikwhere.smartwarehouse_order_service.repository.OrderRepository;
import com.ikwhere.smartwarehouse.grpc.ReleaseStockResponse;
import java.util.ArrayList;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ikwhere.smartwarehouse_order_service.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductCatalogClient productCatalogClient;
    private final InventoryGrpcClient inventoryGrpcClient;
    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            ProductCatalogClient productCatalogClient, InventoryGrpcClient inventoryGrpcClient
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productCatalogClient = productCatalogClient;
        this.inventoryGrpcClient = inventoryGrpcClient;
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {

        List<ProductCatalogClient.ProductDetails> products =
                new ArrayList<>();

        List<OrderItemRequest> reservedItems = new ArrayList<>();

        try {

            // 1. Retrieve product details and check inventory
            for (OrderItemRequest item : request.items()) {

                ProductCatalogClient.ProductDetails product =
                        productCatalogClient.getProduct(item.productId());

                InventoryResponse inventory =
                        inventoryGrpcClient.getInventory(item.productId());

                if (inventory.getAvailableQuantity() < item.quantity()) {
                    throw new IllegalStateException(
                            "Insufficient stock for product: " + item.productId()
                    );
                }

                products.add(new ProductCatalogClient.ProductDetails(
                        product.productId(),
                        inventory.getProductName(),
                        product.unitPrice()
                ));
            }

            // 2. Reserve stock
            for (OrderItemRequest item : request.items()) {

                ReserveStockResponse reservation =
                        inventoryGrpcClient.reserveStock(
                                item.productId(),
                                item.quantity()
                        );

                if (!reservation.getSuccess()) {
                    throw new IllegalStateException(reservation.getMessage());
                }

                reservedItems.add(item);
            }

            // 3. Calculate total amount
            BigDecimal totalAmount = BigDecimal.ZERO;

            for (int i = 0; i < request.items().size(); i++) {

                OrderItemRequest item = request.items().get(i);

                BigDecimal subtotal = products.get(i).unitPrice()
                        .multiply(BigDecimal.valueOf(item.quantity()));

                totalAmount = totalAmount.add(subtotal);
            }

            // 4. Save order
            LocalDateTime dueDate = request.dueDate() != null
                    ? request.dueDate().atTime(17, 0)
                    : LocalDateTime.now().plusDays(7);

            String priority = request.priority() != null
                    ? request.priority().toUpperCase()
                    : "NORMAL";

            Order order = orderRepository.save(
                    request.customerId(),
                    totalAmount,
                    dueDate,
                    priority
            );

            // 5. Save order items
            List<OrderItemResponse> itemResponses =
                    java.util.stream.IntStream.range(0, request.items().size())
                            .mapToObj(i -> {

                                OrderItemRequest item = request.items().get(i);
                                ProductCatalogClient.ProductDetails product =
                                        products.get(i);

                                OrderItem orderItem = new OrderItem(
                                        null,
                                        order.id(),
                                        product.productId(),
                                        product.productName(),
                                        item.quantity(),
                                        product.unitPrice()
                                );

                                OrderItem savedItem = orderItemRepository.save(orderItem);

                                return new OrderItemResponse(
                                        savedItem.id(),
                                        savedItem.productId(),
                                        savedItem.productName(),
                                        savedItem.quantity(),
                                        savedItem.unitPrice(),
                                        savedItem.unitPrice().multiply(
                                                BigDecimal.valueOf(item.quantity())
                                        )
                                );
                            })
                            .toList();

            // 6. Return response
            return new OrderResponse(
                    order.id(),
                    order.customerId(),
                    order.status(),
                    order.totalAmount(),
                    order.createdAt(),
                    itemResponses,
                    order.dueDate(),
                    order.priority(),
                    order.productionStatus()
            );

        } catch (RuntimeException e) {

            // 7. Compensate: release successfully reserved stock
            for (OrderItemRequest item : reservedItems) {
                try {
                    inventoryGrpcClient.releaseStock(
                            item.productId(),
                            item.quantity()
                    );
                } catch (Exception compensationError) {
                    e.addSuppressed(compensationError);
                }
            }

            throw e;
        }
    }
    @Transactional
    public void cancelOrder(Long orderId) {

        // 1. Find order
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        // 2. Check current status
        if ("CANCELLED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " is already cancelled"
            );
        }

        // 3. Retrieve order items
        List<OrderItem> items =
                orderItemRepository.findByOrderId(orderId);

        List<OrderItem> releasedItems = new ArrayList<>();

        try {

            // 4. Release reserved stock through gRPC
            for (OrderItem item : items) {

                ReleaseStockResponse response =
                        inventoryGrpcClient.releaseStock(
                                item.productId(),
                                item.quantity()
                        );

                if (!response.getSuccess()) {
                    throw new IllegalStateException(response.getMessage());
                }

                releasedItems.add(item);
            }

            // 5. Update order status
            int updated = orderRepository.updateStatus(orderId, "CANCELLED");

            if (updated != 1) {
                throw new IllegalStateException(
                        "Could not cancel order: " + orderId
                );
            }

        } catch (RuntimeException e) {

            // 6. Compensation: restore reservations if cancellation fails
            for (OrderItem item : releasedItems) {
                try {
                    ReserveStockResponse response =
                            inventoryGrpcClient.reserveStock(
                                    item.productId(),
                                    item.quantity()
                            );

                    if (!response.getSuccess()) {
                        throw new IllegalStateException(response.getMessage());
                    }

                } catch (Exception compensationError) {
                    e.addSuppressed(compensationError);
                }
            }

            throw e;
        }
    }
    // GET ALL ORDERS
    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {

        return orderRepository.findAll()
                .stream()
                .map(this::buildOrderResponse)
                .toList();
    }

    // GET ORDER BY ID
    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long id) {

        Order order = orderRepository.findById(id).orElseThrow(()->
                    new OrderNotFoundException(id)
                );

        return buildOrderResponse(order);
    }

    // BUILD COMPLETE ORDER RESPONSE
    private OrderResponse buildOrderResponse(Order order) {

        List<OrderItemResponse> items =
                orderItemRepository.findByOrderId(order.id())
                        .stream()
                        .map(item -> {

                            BigDecimal subtotal = item.unitPrice()
                                    .multiply(
                                            BigDecimal.valueOf(item.quantity())
                                    );

                            return new OrderItemResponse(
                                    item.id(),
                                    item.productId(),
                                    item.productName(),
                                    item.quantity(),
                                    item.unitPrice(),
                                    subtotal
                            );
                        })
                        .toList();

        return new OrderResponse(
                order.id(),
                order.customerId(),
                order.status(),
                order.totalAmount(),
                order.createdAt(),
                items,
                order.dueDate(),
                order.priority(),
                order.productionStatus()
        );
    }
}