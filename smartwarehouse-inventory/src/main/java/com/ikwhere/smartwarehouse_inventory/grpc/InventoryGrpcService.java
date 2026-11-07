package com.ikwhere.smartwarehouse_inventory.grpc;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.service.InventoryService;

import com.ikwhere.smartwarehouse.grpc.InventoryServiceGrpc;
import com.ikwhere.smartwarehouse.grpc.GetInventoryRequest;
import com.ikwhere.smartwarehouse.grpc.InventoryResponse;
import com.ikwhere.smartwarehouse.grpc.ReserveStockRequest;
import com.ikwhere.smartwarehouse.grpc.ReserveStockResponse;

import io.grpc.stub.StreamObserver;

import org.springframework.grpc.server.service.GrpcService;

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
}
