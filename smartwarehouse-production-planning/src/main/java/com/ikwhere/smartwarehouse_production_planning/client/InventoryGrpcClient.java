package com.ikwhere.smartwarehouse_production_planning.client;

import com.ikwhere.smartwarehouse.grpc.*;
import org.springframework.grpc.client.GrpcChannelFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InventoryGrpcClient {

    private final InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub;

    public InventoryGrpcClient(GrpcChannelFactory channelFactory) {
        this.inventoryStub = InventoryServiceGrpc.newBlockingStub(channelFactory.createChannel("inventory-service"));
    }

    public List<InventoryResponse> getInventoryBatch(List<Long> productIds) {
        GetInventoryBatchResponse response = inventoryStub.getInventoryBatch(
                GetInventoryBatchRequest.newBuilder()
                        .addAllProductIds(productIds)
                        .build()
        );
        return response.getInventoryList();
    }

    public boolean reserveMaterials(String ref, List<MaterialReservationItem> items) {
        ReserveMaterialsResponse response = inventoryStub.reserveMaterials(
                ReserveMaterialsRequest.newBuilder()
                        .setReservationReference(ref)
                        .addAllItems(items)
                        .build()
        );
        return response.getSuccess();
    }

    public boolean releaseMaterials(String ref, List<MaterialReservationItem> items) {
        ReleaseMaterialsResponse response = inventoryStub.releaseMaterials(
                ReleaseMaterialsRequest.newBuilder()
                        .setReservationReference(ref)
                        .addAllItems(items)
                        .build()
        );
        return response.getSuccess();
    }
}
