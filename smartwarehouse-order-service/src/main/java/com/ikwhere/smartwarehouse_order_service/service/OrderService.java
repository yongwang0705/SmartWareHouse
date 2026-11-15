package com.ikwhere.smartwarehouse_order_service.service;

import com.ikwhere.smartwarehouse.grpc.FulfillMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse_order_service.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_order_service.dto.CreateOrderRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemResponse;
import com.ikwhere.smartwarehouse_order_service.dto.OrderResponse;
import com.ikwhere.smartwarehouse_order_service.model.Order;
import com.ikwhere.smartwarehouse_order_service.model.OrderItem;
import com.ikwhere.smartwarehouse_order_service.repository.OrderItemRepository;
import com.ikwhere.smartwarehouse_order_service.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class OrderService {

    private static final Logger log =
            LoggerFactory.getLogger(OrderService.class);

    private static final String RESERVATION_PREFIX = "ORDER-";

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductCatalogClient productCatalogClient;
    private final InventoryGrpcClient inventoryGrpcClient;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            ProductCatalogClient productCatalogClient,
            InventoryGrpcClient inventoryGrpcClient
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productCatalogClient = productCatalogClient;
        this.inventoryGrpcClient = inventoryGrpcClient;
    }

    /**
     * Creates an order in CREATED state. No inventory is touched yet; the
     * order must be confirmed before stock is checked or production planned.
     */
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {

        List<ProductCatalogClient.ProductDetails> products =
                new ArrayList<>();

        for (OrderItemRequest item : request.items()) {
            products.add(
                    productCatalogClient.getProduct(item.productId())
            );
        }

        BigDecimal totalAmount = BigDecimal.ZERO;

        for (int i = 0; i < request.items().size(); i++) {
            OrderItemRequest item = request.items().get(i);
            totalAmount = totalAmount.add(
                    products.get(i).unitPrice()
                            .multiply(BigDecimal.valueOf(item.quantity()))
            );
        }

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

        List<OrderItemResponse> itemResponses = new ArrayList<>();

        for (int i = 0; i < request.items().size(); i++) {
            OrderItemRequest item = request.items().get(i);
            ProductCatalogClient.ProductDetails product = products.get(i);

            OrderItem savedItem = orderItemRepository.save(new OrderItem(
                    null,
                    order.id(),
                    product.productId(),
                    product.productName(),
                    item.quantity(),
                    product.unitPrice()
            ));

            itemResponses.add(new OrderItemResponse(
                    savedItem.id(),
                    savedItem.productId(),
                    savedItem.productName(),
                    savedItem.quantity(),
                    savedItem.unitPrice(),
                    savedItem.unitPrice().multiply(
                            BigDecimal.valueOf(item.quantity())
                    )
            ));
        }

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
    }

    /**
     * Confirms an order. Confirmation is the point where inventory is checked:
     * - if stock covers the whole order, it is reserved and the order is READY;
     * - otherwise the order enters PENDING_PRODUCTION so the planner can
     *   arrange production for the shortfall.
     */
    @Transactional
    public OrderResponse confirmOrder(Long orderId) {

        Order order = requireOrder(orderId);

        if (!"CREATED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " cannot be confirmed from status "
                            + order.status()
            );
        }

        List<OrderItem> items =
                orderItemRepository.findByOrderId(orderId);
        Map<Long, Integer> quantities = aggregateItemQuantities(items);

        String productionStatus = "PENDING_PRODUCTION";

        if (!quantities.isEmpty()) {
            boolean fullyCovered = true;

            for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
                InventoryResponse inventory =
                        inventoryGrpcClient.getInventory(entry.getKey());

                if (inventory.getAvailableQuantity() < entry.getValue()) {
                    fullyCovered = false;
                    break;
                }
            }

            if (fullyCovered) {
                String reference = RESERVATION_PREFIX + orderId;

                ReserveMaterialsResponse reservation =
                        inventoryGrpcClient.reserveMaterials(
                                reference,
                                quantities
                        );

                if (reservation.getSuccess()) {
                    productionStatus = "READY";
                    registerRollbackRelease(reference, quantities);
                } else {
                    log.warn(
                            "Order {} could not reserve stock ({}); "
                                    + "queueing production",
                            orderId,
                            reservation.getMessage()
                    );
                }
            }
        }

        int updated = orderRepository.confirmOrder(orderId, productionStatus);

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not confirm order: " + orderId
            );
        }

        return buildOrderResponse(requireOrder(orderId));
    }

    /**
     * Final user confirmation. Inventory is consumed (reserved stock for READY
     * orders, or available stock for orders that were produced to order).
     */
    @Transactional
    public OrderResponse completeOrder(Long orderId) {

        Order order = requireOrder(orderId);

        if (!"CONFIRMED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " cannot be completed from status "
                            + order.status()
            );
        }

        String productionStatus = order.productionStatus();

        if (!"READY".equals(productionStatus)
                && !"PRODUCTION_COMPLETED".equals(productionStatus)) {
            throw new IllegalStateException(
                    "Order " + orderId + " is not ready to complete "
                            + "(production status: " + productionStatus + ")"
            );
        }

        List<OrderItem> items =
                orderItemRepository.findByOrderId(orderId);
        Map<Long, Integer> quantities = aggregateItemQuantities(items);

        if (!quantities.isEmpty()) {
            FulfillMaterialsResponse fulfillment =
                    inventoryGrpcClient.fulfillMaterials(
                            RESERVATION_PREFIX + orderId,
                            quantities
                    );

            if (!fulfillment.getSuccess()) {
                throw new IllegalStateException(
                        "Could not fulfil inventory for order " + orderId
                                + ": " + fulfillment.getMessage()
                );
            }
        }

        int updated = orderRepository.completeOrder(orderId);

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not complete order: " + orderId
            );
        }

        return buildOrderResponse(requireOrder(orderId));
    }

    @Transactional
    public void cancelOrder(Long orderId) {

        Order order = requireOrder(orderId);

        if ("CANCELLED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " is already cancelled"
            );
        }

        if ("COMPLETED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " is already completed"
            );
        }

        String productionStatus = order.productionStatus();

        if ("PLANNED".equals(productionStatus)
                || "IN_PRODUCTION".equals(productionStatus)
                || "PRODUCTION_COMPLETED".equals(productionStatus)) {
            throw new IllegalStateException(
                    "Order " + orderId + " cannot be cancelled while production "
                            + "status is " + productionStatus
            );
        }

        List<OrderItem> items =
                orderItemRepository.findByOrderId(orderId);
        Map<Long, Integer> quantities = aggregateItemQuantities(items);

        if (!quantities.isEmpty()) {
            String reference = RESERVATION_PREFIX + orderId;
            ReleaseMaterialsResponse release =
                    inventoryGrpcClient.releaseMaterials(reference, quantities);

            if (release.getSuccess()) {
                log.info(
                        "Released inventory reservation {} for order {}",
                        reference,
                        orderId
                );
            } else if (!isUnknownReservation(release.getMessage())) {
                throw new IllegalStateException(
                        "Could not release inventory for order " + orderId
                                + ": " + release.getMessage()
                );
            }
        }

        int updated = orderRepository.updateStatus(orderId, "CANCELLED");

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not cancel order: " + orderId
            );
        }
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll()
                .stream()
                .map(this::buildOrderResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long id) {
        return buildOrderResponse(requireOrder(id));
    }

    private Order requireOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    private OrderResponse buildOrderResponse(Order order) {
        List<OrderItemResponse> items =
                orderItemRepository.findByOrderId(order.id())
                        .stream()
                        .map(item -> new OrderItemResponse(
                                item.id(),
                                item.productId(),
                                item.productName(),
                                item.quantity(),
                                item.unitPrice(),
                                item.unitPrice().multiply(
                                        BigDecimal.valueOf(item.quantity())
                                )
                        ))
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

    /**
     * If the surrounding transaction rolls back after stock was reserved, the
     * external reservation must be released so it does not leak.
     */
    private void registerRollbackRelease(String reference,
                                         Map<Long, Integer> quantities) {

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status == STATUS_COMMITTED) {
                            return;
                        }

                        try {
                            inventoryGrpcClient.releaseMaterials(
                                    reference,
                                    quantities
                            );
                        } catch (RuntimeException e) {
                            log.error(
                                    "Failed to release reservation {} "
                                            + "after transaction rollback",
                                    reference,
                                    e
                            );
                        }
                    }
                }
        );
    }

    private Map<Long, Integer> aggregateQuantities(
            List<OrderItemRequest> items) {

        Map<Long, Integer> quantities = new TreeMap<>();

        for (OrderItemRequest item : items) {
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }

        return quantities;
    }

    private Map<Long, Integer> aggregateItemQuantities(
            List<OrderItem> items) {

        Map<Long, Integer> quantities = new TreeMap<>();

        for (OrderItem item : items) {
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }

        return quantities;
    }

    private boolean isUnknownReservation(String message) {
        return message != null
                && message.startsWith("Unknown reservation reference");
    }
}
