package com.ikwhere.smartwarehouse_order_service.client;

import com.ikwhere.smartwarehouse_order_service.dto.StoreOrderRequest;
import com.ikwhere.smartwarehouse.grpc.InventoryServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.FulfillMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.FulfillMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.GetInventoryRequest;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.MaterialReservationItem;
import com.ikwhere.smartwarehouse.grpc.OrderStorageAllocation;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReleaseOrderStorageRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseOrderStorageResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;
import com.ikwhere.smartwarehouse.grpc.ReleaseStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseStockResponse;
import com.ikwhere.smartwarehouse.grpc.ShipStoredOrderRequest;
import com.ikwhere.smartwarehouse.grpc.ShipStoredOrderResponse;
import com.ikwhere.smartwarehouse.grpc.StoreOrderStorageRequest;
import com.ikwhere.smartwarehouse.grpc.StoreOrderStorageResponse;
import org.springframework.stereotype.Component;
import org.springframework.grpc.client.GrpcChannelFactory;

import java.util.List;
import java.util.Map;

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

    public ReleaseStockResponse releaseStock(Long productId, Integer quantity) {

        ReleaseStockRequest request = ReleaseStockRequest.newBuilder()
                .setProductId(productId)
                .setQuantity(quantity)
                .build();

        return inventoryStub.releaseStock(request);
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

        return inventoryStub.reserveMaterials(request.build());
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

        return inventoryStub.releaseMaterials(request.build());
    }

    public StoreOrderStorageResponse storeOrderStorage(
            Long orderId,
            List<StoreOrderRequest.StorageAllocation> allocations) {

        StoreOrderStorageRequest.Builder request =
                StoreOrderStorageRequest.newBuilder()
                        .setOrderId(orderId);

        for (StoreOrderRequest.StorageAllocation allocation : allocations) {
            request.addAllocations(OrderStorageAllocation.newBuilder()
                    .setPlotId(allocation.plotId())
                    .setProductId(allocation.productId())
                    .setQuantity(allocation.quantity())
                    .build());
        }

        return inventoryStub.storeOrderStorage(request.build());
    }

    public ShipStoredOrderResponse shipStoredOrder(
            Long orderId,
            String reference,
            Map<Long, Integer> quantities) {

        ShipStoredOrderRequest.Builder request =
                ShipStoredOrderRequest.newBuilder()
                        .setOrderId(orderId)
                        .setReservationReference(reference);

        quantities.forEach((productId, quantity) ->
                request.addItems(MaterialReservationItem.newBuilder()
                        .setProductId(productId)
                        .setQuantity(quantity)
                        .build())
        );

        return inventoryStub.shipStoredOrder(request.build());
    }

    public ReleaseOrderStorageResponse releaseOrderStorage(Long orderId) {
        return inventoryStub.releaseOrderStorage(
                ReleaseOrderStorageRequest.newBuilder()
                        .setOrderId(orderId)
                        .build()
        );
    }

    public FulfillMaterialsResponse fulfillMaterials(
            String reference,
            Map<Long, Integer> quantities) {

        FulfillMaterialsRequest.Builder request =
                FulfillMaterialsRequest.newBuilder()
                        .setReservationReference(reference);

        quantities.forEach((productId, quantity) ->
                request.addItems(MaterialReservationItem.newBuilder()
                        .setProductId(productId)
                        .setQuantity(quantity)
                        .build())
        );

        return inventoryStub.fulfillMaterials(request.build());
    }
}