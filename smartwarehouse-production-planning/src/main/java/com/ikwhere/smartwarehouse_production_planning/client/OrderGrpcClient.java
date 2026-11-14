package com.ikwhere.smartwarehouse_production_planning.client;

import com.ikwhere.smartwarehouse.grpc.GetPendingProductionOrdersRequest;
import com.ikwhere.smartwarehouse.grpc.GetPendingProductionOrdersResponse;
import com.ikwhere.smartwarehouse.grpc.OrderServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.ProductionOrderDto;
import com.ikwhere.smartwarehouse.grpc.UpdateProductionStatusRequest;
import com.ikwhere.smartwarehouse.grpc.UpdateProductionStatusResponse;
import org.springframework.grpc.client.GrpcChannelFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class OrderGrpcClient {

    private static final long DEADLINE_SECONDS = 15;

    private final OrderServiceGrpc.OrderServiceBlockingStub orderStub;

    public OrderGrpcClient(GrpcChannelFactory channelFactory) {
        this.orderStub = OrderServiceGrpc.newBlockingStub(
                channelFactory.createChannel("order-service")
        );
    }

    public List<ProductionOrderDto> getPendingProductionOrders(String start,
                                                               String end) {
        GetPendingProductionOrdersResponse response = orderStub
                .withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS)
                .getPendingProductionOrders(
                        GetPendingProductionOrdersRequest.newBuilder()
                                .setPlanningStart(start)
                                .setPlanningEnd(end)
                                .build()
                );

        return response.getOrdersList();
    }

    public UpdateProductionStatusResponse updateProductionStatus(
            Long orderId,
            String status) {

        return orderStub
                .withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS)
                .updateProductionStatus(
                        UpdateProductionStatusRequest.newBuilder()
                                .setOrderId(orderId)
                                .setProductionStatus(status)
                                .build()
                );
    }
}
