package com.ikwhere.smartwarehouse_inventory.controller;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(
            IllegalArgumentException exception) {

        return Map.of(
                "error",
                safeMessage(exception, "Not found")
        );
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleBadRequest(
            IllegalStateException exception) {

        return Map.of(
                "error",
                safeMessage(exception, "Invalid request")
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleValidation(
            MethodArgumentNotValidException exception) {

        String message = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .findFirst()
                .orElse("Validation failed");

        return Map.of("error", message);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleConflict(
            DataIntegrityViolationException exception) {

        Throwable cause = exception.getMostSpecificCause();
        String detail = cause == null ? null : cause.getMessage();

        String message = detail != null
                && detail.contains("uk_warehouse_plot")
                ? "A plot with this code already exists in this warehouse"
                : "The request conflicts with existing data";

        return Map.of("error", message);
    }

    private String formatFieldError(FieldError error) {
        return error.getField() + ": " + error.getDefaultMessage();
    }

    private static String safeMessage(RuntimeException exception,
                                      String fallback) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? fallback : message;
    }
}
