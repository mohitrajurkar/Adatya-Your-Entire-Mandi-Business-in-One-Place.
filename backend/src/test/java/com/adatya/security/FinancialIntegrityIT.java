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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for the five financial holes that were confirmed against a
 * running instance: every one of them returned HTTP 200 and corrupted the
 * ledger. Each test here pins the rule that now prevents it.
 */
class FinancialIntegrityIT extends AbstractSecurityIT {

    @Test
    @DisplayName("The server computes the bill total; a client-supplied total is ignored")
    void serverRecomputesTotals() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        // 100 quintal at 7000 is 7,00,000. The old code accepted a claimed
        // total of 1 rupee because it never multiplied anything.
        MvcResult result = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "farmerId", farmer,
                                "date", "2026-10-19",
                                "purchaseNumber", "PUR-T-001",
                                "advancePaid", 0,
                                "totalAmount", 1,
                                "items", List.of(Map.of(
                                        "customCommodityName", "Cotton",
                                        "quantity", 100,
                                        "rate", 7000,
                                        "amount", 1))))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals(0, new BigDecimal("700000.00").compareTo(new BigDecimal(body.path("totalAmount").asText())),
                "Total must be derived from quantity x rate");
        assertEquals(0, new BigDecimal("700000.00").compareTo(new BigDecimal(body.path("remainingAmount").asText())));
    }

    @Test
    @DisplayName("An advance larger than the bill total is refused")
    void advanceCannotExceedTotal() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        // 42.5 x 7050 = 299,625. The original data-entry slip paid 300,000 and
        // produced a remaining balance of -375 marked "Paid".
        mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "farmerId", farmer,
                                "date", "2026-10-19",
                                "purchaseNumber", "PUR-T-002",
                                "advancePaid", 300000,
                                "items", List.of(Map.of(
                                        "customCommodityName", "Cotton",
                                        "quantity", 42.5,
                                        "rate", 7050))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        assertEquals(0, purchaseRepository.count(), "Nothing should have been booked");
    }

    @Test
    @DisplayName("Negative quantities and rates are refused")
    void negativeValuesAreRefused() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        for (Object[] line : new Object[][]{{-10, 500}, {10, -500}, {0, 500}}) {
            mockMvc.perform(post("/api/purchases")
                            .header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "farmerId", farmer,
                                    "date", "2026-10-19",
                                    "advancePaid", 0,
                                    "items", List.of(Map.of(
                                            "customCommodityName", "Cotton",
                                            "quantity", line[0],
                                            "rate", line[1]))))))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, purchaseRepository.count());
    }

    @Test
    @DisplayName("A duplicate bill number returns the original instead of booking twice")
    void duplicateBillNumberIsIdempotent() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        String payload = objectMapper.writeValueAsString(Map.of(
                "farmerId", farmer,
                "date", "2026-10-19",
                "purchaseNumber", "PUR-T-003",
                "advancePaid", 0,
                "items", List.of(Map.of("customCommodityName", "Wheat", "quantity", 10, "rate", 2500))));

        MvcResult first = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andReturn();
        MvcResult second = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andReturn();

        long firstId = objectMapper.readTree(first.getResponse().getContentAsString()).path("id").asLong();
        long secondId = objectMapper.readTree(second.getResponse().getContentAsString()).path("id").asLong();

        assertEquals(firstId, secondId, "A repeated submit must not create a second bill");
        assertEquals(1, purchaseRepository.count());
    }

    @Test
    @DisplayName("A payment larger than the outstanding balance is refused")
    void paymentCannotExceedOutstanding() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        long purchaseId = createPurchase(token, farmer, "PUR-T-004", "10", "2500", "0");

        // The hole that accepted 1,00,49,999 against a 1,73,600 bill.
        mockMvc.perform(post("/api/purchases/" + purchaseId + "/payments")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("amount", 9999999))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // Zero and negative payments are refused too.
        for (Object bad : new Object[]{0, -500}) {
            mockMvc.perform(post("/api/purchases/" + purchaseId + "/payments")
                            .header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("amount", bad))))
                    .andExpect(status().isBadRequest());
        }

        var purchase = purchaseRepository.findById(purchaseId).orElseThrow();
        assertEquals(0, new BigDecimal("25000.00").compareTo(purchase.getRemainingAmount()));
    }

    @Test
    @DisplayName("Paying the exact balance settles the bill and clears the farmer")
    void exactPaymentSettlesTheLedger() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        long purchaseId = createPurchase(token, farmer, "PUR-T-005", "10", "2500", "0");

        mockMvc.perform(post("/api/purchases/" + purchaseId + "/payments")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "amount", 25000, "paymentDate", "2026-10-19"))))
                .andExpect(status().isOk());

        var purchase = purchaseRepository.findById(purchaseId).orElseThrow();
        assertEquals("Paid", purchase.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(purchase.getRemainingAmount()));

        var saved = farmerRepository.findById(farmer).orElseThrow();
        assertEquals(0, BigDecimal.ZERO.compareTo(saved.getOutstandingBalance()),
                "Farmer balance is recalculated from the bills, so it must land exactly on zero");
    }

    @Test
    @DisplayName("Selling more than is in stock is refused")
    void cannotSellMoreThanHeld() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        createPurchase(token, farmer, "PUR-T-006", "20", "5000", "0");

        MvcResult stock = mockMvc.perform(get("/api/inventory/stock").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn();
        JsonNode rows = objectMapper.readTree(stock.getResponse().getContentAsString()).path("items");
        JsonNode held = null;
        for (JsonNode row : rows) {
            if (new BigDecimal(row.path("quintals").asText()).signum() > 0) {
                held = row;
                break;
            }
        }
        assertNotNull(held, "Expected some stock from the purchase");

        mockMvc.perform(post("/api/mandi-sales")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "commodityId", held.path("id").asLong(),
                                "buyerName", "Overdraw Mills",
                                "weightQuintals", 5000,
                                "saleRate", 5200))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Deductions cannot exceed the value of the sale")
    void deductionsCannotExceedSaleValue() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        createPurchase(token, farmer, "PUR-T-007", "20", "5000", "0");

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

        mockMvc.perform(post("/api/mandi-sales")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "commodityId", commodityId,
                                "buyerName", "Mills",
                                "weightQuintals", 1,
                                "saleRate", 1000,
                                "hamali", 900,
                                "transport", 900,
                                "mandiCess", 900))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Rupees and paise survive a round trip exactly")
    void decimalPrecisionIsExact() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");

        // 3 x 0.1 is the classic case that binary floating point gets wrong.
        long id = createPurchase(token, farmer, "PUR-T-008", "0.300", "10.10", "0");
        var purchase = purchaseRepository.findById(id).orElseThrow();
        assertEquals(0, new BigDecimal("3.03").compareTo(purchase.getTotalAmount()),
                "0.3 quintal at 10.10 must be exactly 3.03");

        long id2 = createPurchase(token, farmer, "PUR-T-009", "12.345", "999.99", "0");
        var p2 = purchaseRepository.findById(id2).orElseThrow();
        assertEquals(0, new BigDecimal("12344.88").compareTo(p2.getTotalAmount()),
                "12.345 quintal at 999.99 is 12344.87655, which rounds to 12344.88");
    }

    @Test
    @DisplayName("A farmer balance cannot be overwritten through the farmer endpoint")
    void farmerBalanceIsNotClientWritable() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        long farmer = createFarmer(token, "Ramesh");
        createPurchase(token, farmer, "PUR-T-010", "10", "2500", "0");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/farmers/" + farmer)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Ramesh",
                                "outstandingBalance", 0))))
                .andExpect(status().isOk());

        var saved = farmerRepository.findById(farmer).orElseThrow();
        assertEquals(0, new BigDecimal("25000.00").compareTo(saved.getOutstandingBalance()),
                "The ledger balance must survive an attempt to overwrite it");
    }

    private long createPurchase(String token, long farmerId, String number,
                                String quantity, String rate, String advance) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "farmerId", farmerId,
                                "date", "2026-10-19",
                                "purchaseNumber", number,
                                "advancePaid", new BigDecimal(advance),
                                "items", List.of(Map.of(
                                        "customCommodityName", "Wheat",
                                        "quantity", new BigDecimal(quantity),
                                        "rate", new BigDecimal(rate)))))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asLong();
    }
}
