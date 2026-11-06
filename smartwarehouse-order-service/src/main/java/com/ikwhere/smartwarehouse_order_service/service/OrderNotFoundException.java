package com.ikwhere.smartwarehouse_order_service.service;

public class OrderNotFoundException
        extends RuntimeException {

    public OrderNotFoundException(Long id) {
        super("Order not found: " + id);
    }
}