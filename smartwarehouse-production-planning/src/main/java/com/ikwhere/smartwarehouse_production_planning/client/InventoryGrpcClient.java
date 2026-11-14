package com.ikwhere.smartwarehouse_production_planning.client;

import com.ikwhere.smartwarehouse.grpc.GetInventoryBatchRequest;
import com.ikwhere.smartwarehouse.grpc.GetInventoryBatchResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.MaterialReservationItem;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import org.springframework.grpc.client.GrpcChannelFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class InventoryGrpcClient {

    private static final long DEADLINE_SECONDS = 15;

    private final InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub;

    public InventoryGrpcClient(GrpcChannelFactory channelFactory) {
        this.inventoryStub = InventoryServiceGrpc.newBlockingStub(
                channelFactory.createChannel("inventory-service")
        );
    }

    public List<InventoryResponse> getInventoryBatch(List<Long> productIds) {
        GetInventoryBatchResponse response = inventoryStub
                .withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS)
                .getInventoryBatch(GetInventoryBatchRequest.newBuilder()
                        .addAllProductIds(productIds)
                        .build());

        return response.getInventoryList();
    }

    public ReserveMaterialsResponse reserveMaterials(
            String reference,
            Map<Long, Integer> quantities) {

        ReserveMaterialsRequest.Builder request =
                ReserveMaterialsRequest.newBuilder()
                        .setReservationReference(reference);

        quantities.forEach((productId, quantity) ->
                request.addItems(MaterialReservationItem.newBuilder()
                        .setProductId(productId)
                        .setQuantity(quantity)
                        .build())
        );

        return inventoryStub
                .withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS)
                .reserveMaterials(request.build());
    }

    public ReleaseMaterialsResponse releaseMaterials(
            String reference,
            Map<Long, Integer> quantities) {

        ReleaseMaterialsRequest.Builder request =
                ReleaseMaterialsRequest.newBuilder()
                        .setReservationReference(reference);

        quantities.forEach((productId, quantity) ->
                request.addItems(MaterialReservationItem.newBuilder()
                        .setProductId(productId)
                        .setQuantity(quantity)
                        .build())
        );

        return inventoryStub
                .withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS)
                .releaseMaterials(request.build());
    }
}
