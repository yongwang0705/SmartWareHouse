package com.ikwhere.smartwarehouse_order_service.service;

import com.ikwhere.smartwarehouse.grpc.FulfillMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse_order_service.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_order_service.dto.CreateOrderRequest;
import com.ikwhere.smartwarehouse_order_service.dto.DeliverySelectionRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemRequest;
import com.ikwhere.smartwarehouse_order_service.dto.OrderItemResponse;
import com.ikwhere.smartwarehouse_order_service.dto.OrderResponse;
import com.ikwhere.smartwarehouse_order_service.dto.StoreOrderRequest;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
                order.productionStatus(),
                order.deliveryMode(),
                order.deliveryCarrier(),
                order.deliveryDestination(),
                order.deliveryDistanceKm(),
                order.deliveryTransitDays(),
                order.deliveryPrice(),
                order.deliveryContainer(),
                order.deliveredAt()
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
     * Final user confirmation of production/fulfilment readiness. Stock is
     * not consumed here: the order becomes COMPLETED and is shipped later.
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

        int updated = orderRepository.completeOrder(orderId);

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not complete order: " + orderId
            );
        }

        return buildOrderResponse(requireOrder(orderId));
    }

    /**
     * Stores a completed order's products in warehouse plots. The allocations
     * must cover every ordered line exactly; plot capacity and compatibility
     * are validated by the inventory service.
     */
    @Transactional
    public OrderResponse storeOrder(Long orderId,
                                    StoreOrderRequest request) {

        Order order = requireOrder(orderId);

        if (!"COMPLETED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " cannot be stored from status "
                            + order.status()
            );
        }

        if (request == null
                || request.allocations() == null
                || request.allocations().isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one plot allocation is required"
            );
        }

        Map<Long, Integer> required = aggregateItemQuantities(
                orderItemRepository.findByOrderId(orderId)
        );
        Map<Long, Integer> allocated = new TreeMap<>();

        for (StoreOrderRequest.StorageAllocation allocation
                : request.allocations()) {
            if (allocation == null) {
                throw new IllegalArgumentException(
                        "Plot allocations cannot contain null rows"
                );
            }

            allocated.merge(
                    allocation.productId(),
                    allocation.quantity(),
                    Integer::sum
            );
        }

        if (!required.equals(allocated)) {
            throw new IllegalStateException(
                    "Allocations must cover the order exactly: required "
                            + required + ", allocated " + allocated
            );
        }

        var storage = inventoryGrpcClient.storeOrderStorage(
                orderId,
                request.allocations()
        );

        if (!storage.getSuccess()) {
            throw new IllegalStateException(
                    "Could not store order " + orderId
                            + " in the warehouse: " + storage.getMessage()
            );
        }

        int updated = orderRepository.storeOrder(orderId);

        if (updated != 1) {
            try {
                inventoryGrpcClient.releaseOrderStorage(orderId);
            } catch (RuntimeException e) {
                log.error(
                        "Could not roll back warehouse storage for order {}",
                        orderId,
                        e
                );
            }

            throw new IllegalStateException(
                    "Could not mark order " + orderId + " as in warehouse"
            );
        }

        return buildOrderResponse(requireOrder(orderId));
    }

    /**
     * Ships an order with the delivery plan chosen by the user. Normal orders
     * ship from warehouse storage (IN_WAREHOUSE); emergent orders may ship
     * directly from production (COMPLETED).
     */
    @Transactional
    public OrderResponse shipOrder(Long orderId,
                                   DeliverySelectionRequest delivery) {

        Order order = requireOrder(orderId);

        if (!"COMPLETED".equals(order.status())
                && !"IN_WAREHOUSE".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " cannot be shipped from status "
                            + order.status()
            );
        }

        if (delivery == null) {
            throw new IllegalArgumentException(
                    "A delivery option is required to ship order " + orderId
            );
        }

        validateDelivery(delivery);

        boolean fromWarehouse = "IN_WAREHOUSE".equals(order.status());

        List<OrderItem> items =
                orderItemRepository.findByOrderId(orderId);
        Map<Long, Integer> quantities = aggregateItemQuantities(items);

        if (!quantities.isEmpty()) {
            if (fromWarehouse) {
                var shipping = inventoryGrpcClient.shipStoredOrder(
                        orderId,
                        RESERVATION_PREFIX + orderId,
                        quantities
                );

                if (!shipping.getSuccess()) {
                    throw new IllegalStateException(
                            "Could not ship order " + orderId
                                    + " from the warehouse: "
                                    + shipping.getMessage()
                    );
                }
            } else {
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
        }

        int updated = orderRepository.shipOrder(orderId, delivery);

        if (updated != 1) {
            throw new IllegalStateException(
                    "Could not ship order: " + orderId
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

        if ("SHIPPED".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId + " is already shipped"
            );
        }

        if ("IN_WAREHOUSE".equals(order.status())) {
            throw new IllegalStateException(
                    "Order " + orderId
                            + " is stored in the warehouse and must be shipped"
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
                order.productionStatus(),
                order.deliveryMode(),
                order.deliveryCarrier(),
                order.deliveryDestination(),
                order.deliveryDistanceKm(),
                order.deliveryTransitDays(),
                order.deliveryPrice(),
                order.deliveryContainer(),
                order.deliveredAt()
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

    private void validateDelivery(DeliverySelectionRequest delivery) {
        if (delivery == null) {
            return;
        }

        String mode = delivery.mode().trim().toUpperCase(Locale.ROOT);

        if (!Set.of("SEA", "AIR", "FREIGHT").contains(mode)) {
            throw new IllegalArgumentException(
                    "Unsupported delivery mode: " + delivery.mode()
            );
        }
    }

    private boolean isUnknownReservation(String message) {
        return message != null
                && message.startsWith("Unknown reservation reference");
    }
}
