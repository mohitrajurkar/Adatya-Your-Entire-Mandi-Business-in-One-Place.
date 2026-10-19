package com.adatya.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request payloads for purchases.
 *
 * Note what the client is NOT allowed to send any more: line amounts and the
 * purchase total. Those were previously taken straight from the request body,
 * so a caller could book 100 quintals of cotton for a rupee. The server now
 * derives every amount from quantity and rate.
 */
public final class PurchaseRequests {

    private PurchaseRequests() {
    }

    public record CreatePurchase(
            @NotNull(message = "Please select a farmer")
            Long farmerId,

            @NotBlank(message = "Date is required")
            @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "Date must be in YYYY-MM-DD format")
            String date,

            /** Optional. Generated server-side when absent. */
            @Size(max = 60, message = "Bill number must be at most 60 characters")
            String purchaseNumber,

            @NotEmpty(message = "Add at least one commodity line")
            @Size(max = 50, message = "A single bill can hold at most 50 commodity lines")
            @Valid
            List<PurchaseLine> items,

            @NotNull(message = "Advance paid is required")
            @DecimalMin(value = "0.00", message = "Advance paid cannot be negative")
            @Digits(integer = 12, fraction = 2, message = "Advance paid has too many digits")
            BigDecimal advancePaid,

            @Size(max = 40)
            String paymentMode,

            /**
             * Optional idempotency key. Re-sending the same key returns the
             * purchase created the first time instead of booking it twice,
             * which is what a double-tap on a patchy mandi connection does.
             */
            @Size(max = 100)
            String clientRequestId
    ) {
    }

    public record PurchaseLine(
            /**
             * Arrives as a string because it comes from a select element: either
             * a numeric commodity id, or the literal "other" when the trader is
             * naming a grain that is not in their list.
             */
            @Size(max = 40)
            String commodityId,

            @Size(max = 120, message = "Commodity name must be at most 120 characters")
            String customCommodityName,

            @NotNull(message = "Quantity is required")
            @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
            @Digits(integer = 9, fraction = 3, message = "Quantity has too many digits")
            BigDecimal quantity,

            @NotNull(message = "Rate is required")
            @DecimalMin(value = "0.00", message = "Rate cannot be negative")
            @Digits(integer = 12, fraction = 2, message = "Rate has too many digits")
            BigDecimal rate
    ) {
    }

    public record AddPayment(
            @NotNull(message = "Payment amount is required")
            @DecimalMin(value = "0.01", message = "Payment must be greater than zero")
            @Digits(integer = 12, fraction = 2, message = "Payment amount has too many digits")
            BigDecimal amount,

            @Size(max = 40)
            String paymentMode,

            @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "Payment date must be in YYYY-MM-DD format")
            String paymentDate,

            @Size(max = 100)
            String clientRequestId
    ) {
    }
}
