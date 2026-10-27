package com.adatya.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
    }

    @Test
    @DisplayName("MethodArgumentNotValidException produces structured 400 response with error summary and fieldErrors map")
    void handleMethodArgumentNotValidProducesFieldErrors() throws Exception {
        Object target = new Object();
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(target, "createPurchase");
        bindingResult.addError(new FieldError("createPurchase", "farmerId", "Please select a farmer"));
        bindingResult.addError(new FieldError("createPurchase", "advancePaid", "Advance paid cannot be negative"));

        MethodParameter parameter = new MethodParameter(
                GlobalExceptionHandlerTest.class.getDeclaredMethod("dummyMethod"), -1);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(parameter, bindingResult);

        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleValidation(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertNotNull(body.get("error"));

        @SuppressWarnings("unchecked")
        Map<String, String> fieldErrors = (Map<String, String>) body.get("fieldErrors");
        assertNotNull(fieldErrors);
        assertEquals("Please select a farmer", fieldErrors.get("farmerId"));
        assertEquals("Advance paid cannot be negative", fieldErrors.get("advancePaid"));
    }

    @Test
    @DisplayName("IllegalArgumentException returns 400 Bad Request with client message")
    void handleBadInputReturnsBadRequest() {
        IllegalArgumentException ex = new IllegalArgumentException("Quantity must be greater than zero");
        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleBadInput(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Quantity must be greater than zero", response.getBody().get("error"));
        assertFalse((Boolean) response.getBody().get("success"));
    }

    @Test
    @DisplayName("AccessDeniedException returns 403 Forbidden")
    void handleAccessDeniedReturnsForbidden() {
        AccessDeniedException ex = new AccessDeniedException("Forbidden");
        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleAccessDenied(ex);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("You do not have permission to perform this action", response.getBody().get("error"));
    }

    @Test
    @DisplayName("Unexpected Exception returns 500 without leaking stack traces or internal implementation")
    void handleUnexpectedHidesInternalDetail() {
        RuntimeException ex = new RuntimeException("Sensitive database syntax error: column not found");
        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleUnexpected(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals("Something went wrong. Please try again.", response.getBody().get("error"));
        assertFalse(response.getBody().containsKey("stackTrace"));
        assertFalse(response.getBody().get("error").toString().contains("database"));
    }

    @Test
    @DisplayName("HttpMessageNotReadableException returns user-friendly 400 Bad Request")
    void handleUnreadableBodyReturnsFriendlyBadRequest() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException(
                "JSON parse error: Cannot deserialize value of type `java.math.BigDecimal` from String \"abc\"");
        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleUnreadableBody(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertFalse((Boolean) response.getBody().get("success"));
        assertTrue(response.getBody().get("error").toString().contains("Some values could not be read"));
    }

    // Helper method used for MethodParameter reflection in test
    private void dummyMethod() {}
}
