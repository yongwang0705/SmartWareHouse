package com.ikwhere.smartwarehouse_order_service.service;

import java.math.BigDecimal;

public interface ProductCatalogClient {

    ProductDetails getProduct(Long productId);

    record ProductDetails(
            Long productId,
            String productName,
            BigDecimal unitPrice
    ) {
    }
}