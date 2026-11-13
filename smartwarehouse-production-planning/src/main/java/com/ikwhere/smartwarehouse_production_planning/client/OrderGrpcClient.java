package com.ikwhere.smartwarehouse_production_planning.client;

import com.ikwhere.smartwarehouse.grpc.*;
import org.springframework.grpc.client.GrpcChannelFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderGrpcClient {

    private final OrderServiceGrpc.OrderServiceBlockingStub orderStub;

    public OrderGrpcClient(GrpcChannelFactory channelFactory) {
        this.orderStub = OrderServiceGrpc.newBlockingStub(channelFactory.createChannel("order-service"));
    }

    public List<ProductionOrderDto> getPendingProductionOrders(String start, String end) {
        GetPendingProductionOrdersResponse response = orderStub.getPendingProductionOrders(
                GetPendingProductionOrdersRequest.newBuilder()
                        .setPlanningStart(start)
                        .setPlanningEnd(end)
                        .build()
        );
        return response.getOrdersList();
    }

    public boolean updateProductionStatus(Long orderId, String status) {
        UpdateProductionStatusResponse response = orderStub.updateProductionStatus(
                UpdateProductionStatusRequest.newBuilder()
                        .setOrderId(orderId)
                        .setProductionStatus(status)
                        .build()
        );
        return response.getSuccess();
    }
}
