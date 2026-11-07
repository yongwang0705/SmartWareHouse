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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ikwhere.smartwarehouse_order_service.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;
import java.math.BigDecimal;
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

        // 1. Retrieve product information and calculate total
//        List<ProductCatalogClient.ProductDetails> products =
//                request.items().stream()
//                        .map(item -> productCatalogClient.getProduct(item.productId()))
//                        .toList();
        // 1. Retrieve product information and check inventory
        List<ProductCatalogClient.ProductDetails> products =
                request.items().stream()
                        .map(item -> {

                            // Get product price from Product Catalog
                            ProductCatalogClient.ProductDetails product =
                                    productCatalogClient.getProduct(item.productId());

                            // Get stock from Inventory Service through gRPC
                            InventoryResponse inventory =
                                    inventoryGrpcClient.getInventory(item.productId());

                            // Check available stock
                            if (inventory.getAvailableQuantity() < item.quantity()) {
                                throw new IllegalStateException(
                                        "Insufficient stock for product: "
                                                + item.productId()
                                );
                            }

                            // Reserve stock through gRPC
                            ReserveStockResponse reservation =
                                    inventoryGrpcClient.reserveStock(
                                            item.productId(),
                                            item.quantity()
                                    );

                            if (!reservation.getSuccess()) {
                                throw new IllegalStateException(
                                        reservation.getMessage()
                                );
                            }

                            return new ProductCatalogClient.ProductDetails(
                                    product.productId(),
                                    inventory.getProductName(),
                                    product.unitPrice()
                            );
                        })
                        .toList();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (int i = 0; i < request.items().size(); i++) {
            OrderItemRequest item = request.items().get(i);

            BigDecimal subtotal = products.get(i).unitPrice()
                    .multiply(BigDecimal.valueOf(item.quantity()));

            totalAmount = totalAmount.add(subtotal);
        }

        // 2. Save order header
        Order order = orderRepository.save(
                request.customerId(),
                totalAmount
        );

        // 3. Save order items
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

                            orderItemRepository.save(orderItem);

                            return new OrderItemResponse(
                                    null,
                                    product.productId(),
                                    product.productName(),
                                    item.quantity(),
                                    product.unitPrice(),
                                    product.unitPrice().multiply(
                                            BigDecimal.valueOf(item.quantity())
                                    )
                            );
                        })
                        .toList();

        // 4. Return response
        return new OrderResponse(
                order.id(),
                order.customerId(),
                order.status(),
                order.totalAmount(),
                order.createdAt(),
                itemResponses
        );
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
                items
        );
    }
}