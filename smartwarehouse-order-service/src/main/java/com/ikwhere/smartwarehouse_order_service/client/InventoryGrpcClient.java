package com.ikwhere.smartwarehouse_order_service.client;

import com.ikwhere.smartwarehouse.grpc.InventoryServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.GetInventoryRequest;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;

import org.springframework.stereotype.Component;
import org.springframework.grpc.client.GrpcChannelFactory;

@Component
public class InventoryGrpcClient {

    private final InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub;

    public InventoryGrpcClient(GrpcChannelFactory channelFactory) {
        this.inventoryStub = InventoryServiceGrpc
                .newBlockingStub(channelFactory.createChannel("inventory"));
    }

    public InventoryResponse getInventory(Long productId) {

        GetInventoryRequest request = GetInventoryRequest.newBuilder()
                .setProductId(productId)
                .build();

        return inventoryStub.getInventory(request);
    }

    public ReserveStockResponse reserveStock(Long productId, Integer quantity) {

        ReserveStockRequest request = ReserveStockRequest.newBuilder()
                .setProductId(productId)
                .setQuantity(quantity)
                .build();

        return inventoryStub.reserveStock(request);
    }
}