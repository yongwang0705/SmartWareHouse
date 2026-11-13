package com.ikwhere.smartwarehouse_production_planning.service;

import com.ikwhere.smartwarehouse.grpc.*;
import com.ikwhere.smartwarehouse_production_planning.client.OrderGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.client.InventoryGrpcClient;
import com.ikwhere.smartwarehouse_production_planning.engine.SchedulingEngine;
import com.ikwhere.smartwarehouse_production_planning.repository.ConfigurationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PlanningWorkflowService {

    private final SchedulingEngine schedulingEngine;
    private final ConfigurationRepository configRepository;
    private final OrderGrpcClient orderGrpcClient;
    private final InventoryGrpcClient inventoryGrpcClient;

    public PlanningWorkflowService(SchedulingEngine schedulingEngine,
                                   ConfigurationRepository configRepository,
                                   OrderGrpcClient orderGrpcClient,
                                   InventoryGrpcClient inventoryGrpcClient) {
        this.schedulingEngine = schedulingEngine;
        this.configRepository = configRepository;
        this.orderGrpcClient = orderGrpcClient;
        this.inventoryGrpcClient = inventoryGrpcClient;
    }

    public List<ProductionOrderDto> getPendingOrders(String start, String end) {
        return orderGrpcClient.getPendingProductionOrders(start, end);
    }

    public void confirmPlan(Long planId) {
        // Implementation logic for Atomic Batch Reservation via gRPC
        // inventoryGrpcClient.reserveMaterials(...)
    }
}
