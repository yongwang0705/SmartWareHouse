package com.ikwhere.smartwarehouse_order_service.service;
import com.ikwhere.smartwarehouse_order_service.service.ProductCatalogClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
@Component
public class MockProductCatalogClient implements ProductCatalogClient{

    private static final Map<Long, ProductDetails> PRODUCTS = Map.of(
            101L, new ProductDetails(
                    101L,
                    "Laptop",
                    new BigDecimal("1000.00")
            ),
            102L, new ProductDetails(
                    102L,
                    "Keyboard",
                    new BigDecimal("50.00")
            ),
            103L, new ProductDetails(
                    103L,
                    "Mouse",
                    new BigDecimal("25.00")
            )
    );

    @Override
    public ProductDetails getProduct(Long productId) {

        ProductDetails product = PRODUCTS.get(productId);

        if (product == null) {
            throw new IllegalArgumentException(
                    "Product not found: " + productId
            );
        }

        return product;
    }
}
