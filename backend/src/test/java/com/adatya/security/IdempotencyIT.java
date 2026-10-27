package com.adatya.security;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A retried submission must not book a second transaction.
 *
 * This is the double-tap a trader produces when the connection is slow and the
 * first tap appears to do nothing.
 */
class IdempotencyIT extends AbstractSecurityIT {

    @Test
    @DisplayName("Repeating a purchase request key returns the original bill")
    void purchaseRetryReturnsOriginal() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        // No bill number: the server allocates one, so the request key is the
        // only thing that can identify the retry.
        String payload = objectMapper.writeValueAsString(Map.of(
                "farmerId", farmer,
                "date", "2026-10-19",
                "advancePaid", 0,
                "clientRequestId", "submit-0001",
                "items", List.of(Map.of(
                        "customCommodityName", "Cotton", "quantity", 10, "rate", 7000))));

        long first = postPurchase(token, payload);
        long second = postPurchase(token, payload);
        long third = postPurchase(token, payload);

        assertEquals(first, second);
        assertEquals(first, third);
        assertEquals(1, purchaseRepository.count(), "Three submits, one bill");

        var farmerRow = farmerRepository.findById(farmer).orElseThrow();
        assertEquals(0, new BigDecimal("70000.00").compareTo(farmerRow.getOutstandingBalance()),
                "The farmer must be owed for one bill, not three");
    }

    @Test
    @DisplayName("A different key books a genuinely separate bill")
    void differentKeyCreatesSeparatePurchase() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        long first = postPurchase(token, purchasePayload(farmer, "submit-A"));
        long second = postPurchase(token, purchasePayload(farmer, "submit-B"));

        assertNotEquals(first, second);
        assertEquals(2, purchaseRepository.count());
    }

    @Test
    @DisplayName("A request key from one trader does not collide with another's")
    void keysAreScopedPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");
        long farmerA = createFarmer(tokenA, "Ramesh");
        long farmerB = createFarmer(tokenB, "Vitthal");

        // Same key text, two different businesses.
        long a = postPurchase(tokenA, purchasePayload(farmerA, "same-key"));
        long b = postPurchase(tokenB, purchasePayload(farmerB, "same-key"));

        assertNotEquals(a, b, "Each trader must get their own bill");
        assertEquals(2, purchaseRepository.count());
    }

    @Test
    @DisplayName("Repeating a payment request key records the payment once")
    void paymentRetryIsRecordedOnce() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        long purchaseId = postPurchase(token, purchasePayload(farmer, "bill-key"));

        String payment = objectMapper.writeValueAsString(Map.of(
                "amount", 20000,
                "paymentMode", "Cash",
                "paymentDate", "2026-10-19",
                "clientRequestId", "pay-0001"));

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(post("/api/purchases/" + purchaseId + "/payments")
                            .header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON).content(payment))
                    .andExpect(status().isOk());
        }

        var purchase = purchaseRepository.findById(purchaseId).orElseThrow();
        assertEquals(0, new BigDecimal("20000.00").compareTo(purchase.getAdvancePaid()),
                "Three identical submits must deduct the amount once");
        assertEquals(0, new BigDecimal("50000.00").compareTo(purchase.getRemainingAmount()));
    }

    @Test
    @DisplayName("Two genuinely different payments with distinct keys both apply")
    void distinctPaymentKeysBothApply() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        long purchaseId = postPurchase(token, purchasePayload(farmer, "bill-key"));

        // Same amount, same day, different keys. The old time-window heuristic
        // would have rejected the second as a duplicate.
        for (String key : new String[]{"pay-1", "pay-2"}) {
            mockMvc.perform(post("/api/purchases/" + purchaseId + "/payments")
                            .header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "amount", 10000,
                                    "paymentDate", "2026-10-19",
                                    "clientRequestId", key))))
                    .andExpect(status().isOk());
        }

        var purchase = purchaseRepository.findById(purchaseId).orElseThrow();
        assertEquals(0, new BigDecimal("20000.00").compareTo(purchase.getAdvancePaid()),
                "Both genuine payments must apply");
    }

    @Test
    @DisplayName("Repeating a sale request key does not sell the stock twice")
    void saleRetryIsRecordedOnce() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        postPurchase(token, purchasePayload(farmer, "bill-key"));

        JsonNode rows = objectMapper.readTree(mockMvc.perform(get("/api/inventory/stock")
                        .header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString()).path("items");
        long commodityId = 0;
        for (JsonNode row : rows) {
            if (new BigDecimal(row.path("quintals").asText()).signum() > 0) {
                commodityId = row.path("id").asLong();
                break;
            }
        }
        assertTrue(commodityId > 0);

        String sale = objectMapper.writeValueAsString(Map.of(
                "commodityId", commodityId,
                "buyerName", "Laxmi Mills",
                "weightQuintals", 6,
                "saleRate", 7200,
                "clientRequestId", "sale-0001"));

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(post("/api/mandi-sales")
                            .header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON).content(sale))
                    .andExpect(status().isOk());
        }

        JsonNode sales = objectMapper.readTree(mockMvc.perform(get("/api/mandi-sales")
                        .header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString());
        assertEquals(1, sales.size(), "Three submits, one sale");

        // And the stock reflects a single sale: 10 purchased less 6 sold.
        JsonNode after = objectMapper.readTree(mockMvc.perform(get("/api/inventory/stock")
                        .header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString()).path("items");
        for (JsonNode row : after) {
            if (row.path("id").asLong() == commodityId) {
                assertEquals(0, new BigDecimal("4.000")
                                .compareTo(new BigDecimal(row.path("quintals").asText())),
                        "Stock must be reduced once, not three times");
            }
        }
    }

    @Test
    @DisplayName("Submissions without a key still work")
    void requestsWithoutKeysAreUnaffected() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        long id = postPurchase(token, objectMapper.writeValueAsString(Map.of(
                "farmerId", farmer,
                "date", "2026-10-19",
                "advancePaid", 0,
                "items", List.of(Map.of(
                        "customCommodityName", "Gram", "quantity", 5, "rate", 5600)))));

        assertTrue(id > 0);
        assertEquals(1, purchaseRepository.count());
    }

    private String purchasePayload(long farmerId, String key) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "farmerId", farmerId,
                "date", "2026-10-19",
                "advancePaid", 0,
                "clientRequestId", key,
                "items", List.of(Map.of(
                        "customCommodityName", "Cotton", "quantity", 10, "rate", 7000))));
    }

    private long postPurchase(String token, String payload) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asLong();
    }
}
