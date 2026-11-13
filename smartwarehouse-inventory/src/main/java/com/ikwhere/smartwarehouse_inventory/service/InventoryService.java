package com.ikwhere.smartwarehouse_inventory.service;

import com.ikwhere.smartwarehouse_inventory.model.Inventory;
import com.ikwhere.smartwarehouse_inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    @Transactional(readOnly = true)
    public List<Inventory> getAllInventory() {
        return inventoryRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<com.ikwhere.smartwarehouse_inventory.dto.BomItemResponse> getBOM() {
        return inventoryRepository.getBOM();
    }

    @Transactional(readOnly = true)
    public Inventory getInventoryByProductId(Long productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Inventory not found for product: " + productId
                        ));
    }

    @Transactional
    public void reserveStock(Long productId, Integer quantity) {
        validateQuantity(quantity);

        Inventory inventory = getInventoryByProductId(productId);

        boolean reserved = inventoryRepository.reserveStock(productId, quantity);

        if (!reserved) {
            throw new IllegalStateException(
                    "Insufficient available stock for product: " + productId
            );
        }
    }

    @Transactional
    public void releaseStock(Long productId, Integer quantity) {
        validateQuantity(quantity);

        getInventoryByProductId(productId);

        boolean released = inventoryRepository.releaseStock(productId, quantity);

        if (!released) {
            throw new IllegalStateException(
                    "Cannot release more stock than currently reserved for product: "
                            + productId
            );
        }
    }

    private void validateQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException(
                    "Quantity must be greater than zero"
            );
        }
    }
}