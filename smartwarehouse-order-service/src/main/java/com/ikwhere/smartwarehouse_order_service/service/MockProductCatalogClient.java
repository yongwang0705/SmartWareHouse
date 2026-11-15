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
            ),
            201L, new ProductDetails(
                    201L,
                    "Keycap Set",
                    new BigDecimal("15.00")
            ),
            202L, new ProductDetails(
                    202L,
                    "Key Switch Set",
                    new BigDecimal("30.00")
            ),
            203L, new ProductDetails(
                    203L,
                    "Keyboard PCB",
                    new BigDecimal("40.00")
            ),
            204L, new ProductDetails(
                    204L,
                    "USB-C Cable",
                    new BigDecimal("8.00")
            ),
            205L, new ProductDetails(
                    205L,
                    "Keyboard Case",
                    new BigDecimal("20.00")
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
