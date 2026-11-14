package com.ikwhere.smartwarehouse_order_service.grpc;

import com.ikwhere.smartwarehouse.grpc.GetPendingProductionOrdersRequest;
import com.ikwhere.smartwarehouse.grpc.GetPendingProductionOrdersResponse;
import com.ikwhere.smartwarehouse.grpc.OrderItemDto;
import com.ikwhere.smartwarehouse.grpc.OrderServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse.grpc.UpdateProductionStatusRequest;
import com.ikwhere.smartwarehouse.grpc.UpdateProductionStatusResponse;
import com.ikwhere.smartwarehouse_order_service.model.Order;
import com.ikwhere.smartwarehouse_order_service.model.OrderItem;
import com.ikwhere.smartwarehouse_order_service.repository.OrderItemRepository;
import com.ikwhere.smartwarehouse_order_service.repository.OrderRepository;

import io.grpc.stub.StreamObserver;
import org.springframework.grpc.server.service.GrpcService;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;

@GrpcService
public class OrderGrpcService extends OrderServiceGrpc.OrderServiceImplBase {

    private static final Set<String> PRODUCTION_STATUSES = Set.of(
            "PENDING_PRODUCTION",
            "PLANNED",
            "IN_PRODUCTION",
            "PRODUCTION_COMPLETED"
    );

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public OrderGrpcService(OrderRepository orderRepository,
                            OrderItemRepository orderItemRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    @Override
    public void getPendingProductionOrders(
            GetPendingProductionOrdersRequest request,
            StreamObserver<GetPendingProductionOrdersResponse> responseObserver) {

        try {
            LocalDate planningStart = parseDate(request.getPlanningStart(), LocalDate.now());
            LocalDate planningEnd = parseDate(request.getPlanningEnd(), planningStart.plusDays(30));

            if (planningEnd.isBefore(planningStart)) {
                throw new IllegalArgumentException(
                        "planning_end must not be before planning_start"
                );
            }

            List<Order> orders =
                    orderRepository.findPendingForPlanning(planningStart, planningEnd);

            GetPendingProductionOrdersResponse.Builder response =
                    GetPendingProductionOrdersResponse.newBuilder();

            for (Order order : orders) {
                ProductionOrderDto.Builder orderBuilder = ProductionOrderDto.newBuilder()
                        .setOrderId(order.id())
                        .setCustomerId(order.customerId())
                        .setStatus(order.productionStatus())
                        .setOrderStatus(order.status())
                        .setPriority(order.priority())
                        .setCreatedAt(order.createdAt().toString())
                        .setDueDate(order.dueDate().toLocalDate().toString());

                for (OrderItem item : orderItemRepository.findByOrderId(order.id())) {
                    orderBuilder.addItems(OrderItemDto.newBuilder()
                            .setProductId(item.productId())
                            .setProductName(item.productName() == null ? "" : item.productName())
                            .setQuantity(item.quantity())
                            .build());
                }

                response.addOrders(orderBuilder.build());
            }

            responseObserver.onNext(response.build());
            responseObserver.onCompleted();

        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INVALID_ARGUMENT
                    .withDescription(e.getMessage())
                    .asRuntimeException());
        }
    }

    @Override
    public void updateProductionStatus(
            UpdateProductionStatusRequest request,
            StreamObserver<UpdateProductionStatusResponse> responseObserver) {

        boolean success = false;
        String message;

        try {
            String status = request.getProductionStatus();
            if (status == null || !PRODUCTION_STATUSES.contains(status)) {
                message = "Unsupported production status: " + status;
            } else {
                int updated = orderRepository.updateProductionStatus(
                        request.getOrderId(),
                        status
                );

                success = updated == 1;
                message = success
                        ? "Production status updated"
                        : "Order not found or cancelled: " + request.getOrderId();
            }
        } catch (Exception e) {
            message = e.getMessage() != null
                    ? e.getMessage()
                    : "Production status update failed";
        }

        responseObserver.onNext(UpdateProductionStatusResponse.newBuilder()
                .setSuccess(success)
                .setMessage(message)
                .build());
        responseObserver.onCompleted();
    }

    private LocalDate parseDate(String value, LocalDate defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Invalid date '" + value + "', expected yyyy-MM-dd"
            );
        }
    }
}
