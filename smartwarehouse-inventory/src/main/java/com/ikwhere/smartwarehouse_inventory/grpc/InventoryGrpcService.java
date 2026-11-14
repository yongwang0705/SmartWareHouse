package com.ikwhere.smartwarehouse_inventory.grpc;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.service.InventoryService;

import com.ikwhere.smartwarehouse.grpc.GetInventoryBatchRequest;
import com.ikwhere.smartwarehouse.grpc.GetInventoryBatchResponse;
import com.ikwhere.smartwarehouse.grpc.ReleaseStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseStockResponse;
import com.ikwhere.smartwarehouse.grpc.InventoryServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.GetInventoryRequest;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.MaterialReservationItem;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReleaseMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveMaterialsResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;

import io.grpc.stub.StreamObserver;

import org.springframework.grpc.server.service.GrpcService;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@GrpcService
public class InventoryGrpcService
        extends InventoryServiceGrpc.InventoryServiceImplBase {

    private final InventoryService inventoryService;

    public InventoryGrpcService(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @Override
    public void getInventory(
            GetInventoryRequest request,
            StreamObserver<InventoryResponse> responseObserver) {

        Inventory inventory =
                inventoryService.getInventoryByProductId(request.getProductId());

        InventoryResponse response = InventoryResponse.newBuilder()
                .setProductId(inventory.productId())
                .setProductName(inventory.productName())
                .setQuantity(inventory.quantity())
                .setReservedQuantity(inventory.reservedQuantity())
                .setAvailableQuantity(inventory.getAvailableQuantity())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void reserveStock(
            ReserveStockRequest request,
            StreamObserver<ReserveStockResponse> responseObserver) {

        try {
            inventoryService.reserveStock(
                    request.getProductId(),
                    request.getQuantity()
            );

            Inventory inventory =
                    inventoryService.getInventoryByProductId(request.getProductId());

            ReserveStockResponse response = ReserveStockResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Stock reserved successfully")
                    .setAvailableQuantity(inventory.getAvailableQuantity())
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {
            ReserveStockResponse response = ReserveStockResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage(e.getMessage() != null ? e.getMessage() : "Stock reservation failed")
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }

    @Override
    public void getInventoryBatch(
            GetInventoryBatchRequest request,
            StreamObserver<GetInventoryBatchResponse> responseObserver) {

        List<Inventory> inventories = inventoryService.getInventoryBatch(
                request.getProductIdsList()
        );

        GetInventoryBatchResponse.Builder response =
                GetInventoryBatchResponse.newBuilder();

        for (Inventory inventory : inventories) {
            response.addInventory(InventoryResponse.newBuilder()
                    .setProductId(inventory.productId())
                    .setProductName(inventory.productName())
                    .setQuantity(inventory.quantity())
                    .setReservedQuantity(inventory.reservedQuantity())
                    .setAvailableQuantity(inventory.getAvailableQuantity())
                    .build());
        }

        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    @Override
    public void reserveMaterials(
            ReserveMaterialsRequest request,
            StreamObserver<ReserveMaterialsResponse> responseObserver) {

        try {
            InventoryService.BatchOperationResult result =
                    inventoryService.reserveMaterials(
                            request.getReservationReference(),
                            toQuantityMap(request.getItemsList())
                    );

            responseObserver.onNext(ReserveMaterialsResponse.newBuilder()
                    .setSuccess(result.success())
                    .setMessage(result.message())
                    .build());
            responseObserver.onCompleted();

        } catch (Exception e) {
            responseObserver.onNext(ReserveMaterialsResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage(e.getMessage() != null
                            ? e.getMessage()
                            : "Material reservation failed")
                    .build());
            responseObserver.onCompleted();
        }
    }

    @Override
    public void releaseMaterials(
            ReleaseMaterialsRequest request,
            StreamObserver<ReleaseMaterialsResponse> responseObserver) {

        try {
            InventoryService.BatchOperationResult result =
                    inventoryService.releaseMaterials(
                            request.getReservationReference(),
                            toQuantityMap(request.getItemsList())
                    );

            responseObserver.onNext(ReleaseMaterialsResponse.newBuilder()
                    .setSuccess(result.success())
                    .setMessage(result.message())
                    .build());
            responseObserver.onCompleted();

        } catch (Exception e) {
            responseObserver.onNext(ReleaseMaterialsResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage(e.getMessage() != null
                            ? e.getMessage()
                            : "Material release failed")
                    .build());
            responseObserver.onCompleted();
        }
    }

    private Map<Long, Integer> toQuantityMap(List<MaterialReservationItem> items) {
        Map<Long, Integer> quantities = new TreeMap<>();
        for (MaterialReservationItem item : items) {
            quantities.merge(item.getProductId(), item.getQuantity(), Integer::sum);
        }
        return quantities;
    }

    @Override
    public void releaseStock(
            ReleaseStockRequest request,
            StreamObserver<ReleaseStockResponse> responseObserver
    ) {
        try {
            inventoryService.releaseStock(
                    request.getProductId(),
                    request.getQuantity()
            );

            Inventory inventory = inventoryService.getInventoryByProductId(
                    request.getProductId()
            );

            ReleaseStockResponse response = ReleaseStockResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Stock released successfully")
                    .setAvailableQuantity(inventory.getAvailableQuantity())
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {

            ReleaseStockResponse response = ReleaseStockResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage(
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Stock release failed"
                    )
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
}
