package com.ikwhere.smartwarehouse_order_service.controller;

import com.ikwhere.smartwarehouse_order_service.service.OrderNotFoundException;
import io.grpc.StatusRuntimeException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleBadRequest(
            IllegalArgumentException exception) {

        return Map.of(
                "error", exception.getMessage() != null
                        ? exception.getMessage()
                        : "Invalid request"
        );
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleIllegalStateException(
            IllegalStateException exception) {

        return Map.of(
                "error", exception.getMessage()
        );
    }

    @ExceptionHandler(StatusRuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public Map<String, String> handleGrpcFailure(
            StatusRuntimeException exception) {

        return Map.of(
                "error", "Inventory service unavailable: "
                        + exception.getStatus().getCode()
        );
    }
}
