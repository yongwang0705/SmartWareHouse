package com.ikwhere.smartwarehouse_order_service;

import com.ikwhere.smartwarehouse_order_service.service.ProductCatalogClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class ProductCatalogClientTest {

    @Autowired
    private ProductCatalogClient productCatalogClient;

    @Test
    void testGetProduct() {

        ProductCatalogClient.ProductDetails product =
                productCatalogClient.getProduct(101L);

        assertNotNull(product);

        System.out.println(product.productName());
        System.out.println(product.unitPrice());
    }
}
