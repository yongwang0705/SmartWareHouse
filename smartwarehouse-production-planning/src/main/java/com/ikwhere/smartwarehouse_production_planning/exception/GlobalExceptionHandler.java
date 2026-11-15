package com.ikwhere.smartwarehouse_production_planning.exception;

import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException e) {
        return build(e.getStatus(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException e) {

        String message = e.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .findFirst()
                .orElse("Validation failed");

        return build(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(StatusRuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleGrpc(StatusRuntimeException e) {
        log.error("Downstream gRPC call failed", e);
        return build(
                HttpStatus.BAD_GATEWAY,
                "Downstream service unavailable: " + e.getStatus().getCode()
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(
            IllegalArgumentException e) {
        return build(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(
            DataIntegrityViolationException e) {

        String detail = mostSpecificMessage(e);

        if (detail.contains("violates not-null constraint")) {
            Matcher column = Pattern.compile("column \"([^\"]+)\"")
                    .matcher(detail);

            String message = column.find()
                    ? "Missing required value: " + column.group(1)
                    : "A required value is missing";
            log.warn("Rejected request with missing value: {}", detail);
            return build(HttpStatus.BAD_REQUEST, message);
        }

        String message = describeConstraint(detail);
        log.warn("Rejected request conflicting with existing data: {}", detail);
        return build(HttpStatus.CONFLICT, message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(
            HttpMessageNotReadableException e) {

        log.warn("Rejected malformed request body: {}", e.getMessage());
        return build(
                HttpStatus.BAD_REQUEST,
                "Malformed request body. Check field types and date formats "
                        + "(for example 2026-11-20 and 08:00)."
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException e) {

        return build(
                HttpStatus.BAD_REQUEST,
                "Invalid value for parameter '" + e.getName() + "'"
        );
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameter(
            MissingServletRequestParameterException e) {

        return build(
                HttpStatus.BAD_REQUEST,
                "Missing required parameter '" + e.getParameterName() + "'"
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled production planning error", e);
        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal server error"
        );
    }

    private String formatFieldError(FieldError error) {
        return error.getField() + ": " + error.getDefaultMessage();
    }

    private String mostSpecificMessage(DataIntegrityViolationException e) {
        Throwable cause = e.getMostSpecificCause();
        String message = cause == null ? null : cause.getMessage();
        return message == null || message.isBlank()
                ? String.valueOf(e.getMessage())
                : message;
    }

    private String describeConstraint(String detail) {
        Matcher constraint = Pattern.compile("constraint \"([^\"]+)\"")
                .matcher(detail);

        if (!constraint.find()) {
            return "The request conflicts with existing production data";
        }

        return switch (constraint.group(1)) {
            case "work_center_code_key" ->
                    "A work center with this code already exists";
            case "employee_employee_number_key" ->
                    "An employee with this employee number already exists";
            case "uk_routing_sequence" ->
                    "An operation with this sequence number already exists "
                            + "for this routing";
            case "uk_product_material" ->
                    "This BOM line already exists for the product and material";
            case "uk_employee_skill" ->
                    "This employee already has this skill";
            case "production_working_calendar_work_date_key" ->
                    "A working-calendar entry already exists for this date";
            default -> constraint.group(1).endsWith("_fkey")
                    ? "The referenced record does not exist"
                    : "The request conflicts with existing production data";
        };
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status,
                                                      String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);

        return ResponseEntity.status(status).body(body);
    }
}
