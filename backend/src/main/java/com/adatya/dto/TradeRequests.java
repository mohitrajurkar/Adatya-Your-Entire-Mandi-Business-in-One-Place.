package com.adatya.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/**
 * Request payloads for sales, stock, farmers and commodities.
 *
 * As with purchases, derived figures (subtotal, net amount) are no longer
 * accepted from the client; the server computes them.
 */
public final class TradeRequests {

    private TradeRequests() {
    }

    public record CreateSale(
            @NotNull(message = "Please select a commodity")
            Long commodityId,

            @NotBlank(message = "Buyer or mill name is required")
            @Size(max = 160)
            String buyerName,

            @Size(max = 20)
            String buyerMobile,

            @Size(max = 160)
            String buyerLocation,

            @Size(max = 40)
            String vehicleNumber,

            @NotNull(message = "Weight is required")
            @DecimalMin(value = "0.001", message = "Weight must be greater than zero")
            @Digits(integer = 9, fraction = 3, message = "Weight has too many digits")
            BigDecimal weightQuintals,

            @NotNull(message = "Sale rate is required")
            @DecimalMin(value = "0.00", message = "Sale rate cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal saleRate,

            @Min(value = 0, message = "Bags cannot be negative")
            @Max(value = 1000000, message = "Bags value is unrealistically large")
            Integer bags,

            @DecimalMin(value = "0.00", message = "Hamali cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal hamali,

            @DecimalMin(value = "0.00", message = "Transport cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal transport,

            @DecimalMin(value = "0.00", message = "Mandi cess cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal mandiCess,

            @Pattern(regexp = "Paid|Partial|Pending", message = "Payment status must be Paid, Partial or Pending")
            String paymentStatus,

            @Size(max = 40)
            String paymentMode,

            @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "Date must be in YYYY-MM-DD format")
            String date,

            @Size(max = 2000)
            String notes,

            @Size(max = 100)
            String clientRequestId
    ) {
    }

    public record CreateStockAdjustment(
            @NotNull(message = "Please select a commodity")
            Long commodityId,

            @NotNull(message = "Adjustment type is required")
            @Pattern(regexp = "opening|inward|outward|adjustment",
                     message = "Type must be opening, inward, outward or adjustment")
            String type,

            @Min(value = 0, message = "Bags cannot be negative")
            @Max(value = 1000000)
            Integer bags,

            @NotNull(message = "Weight is required")
            @DecimalMin(value = "0.001", message = "Weight must be greater than zero")
            @Digits(integer = 9, fraction = 3)
            BigDecimal weightQuintals,

            @DecimalMin(value = "0.00", message = "Rate cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal rate,

            @Size(max = 255)
            String reason,

            @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "Date must be in YYYY-MM-DD format")
            String date
    ) {
    }

    public record SaveFarmer(
            @NotBlank(message = "Farmer name is required")
            @Size(max = 160, message = "Farmer name must be at most 160 characters")
            String name,

            @Size(max = 160)
            String village,

            @Pattern(regexp = "|\\d{10}", message = "Mobile must be a 10-digit number")
            String mobile
    ) {
    }

    public record SaveCommodity(
            @NotBlank(message = "Commodity name is required")
            @Size(max = 120)
            String name,

            @NotNull(message = "Default rate is required")
            @DecimalMin(value = "0.00", message = "Default rate cannot be negative")
            @Digits(integer = 12, fraction = 2)
            BigDecimal defaultRate
    ) {
    }
}
