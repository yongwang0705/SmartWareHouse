package com.ikwhere.smartwarehouse_order_service.controller;

import com.ikwhere.smartwarehouse_order_service.service.OrderNotFoundException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(
            OrderNotFoundException exception) {

        return Map.of(
                "error", exception.getMessage()
        );
    }
}