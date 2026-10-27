package com.adatya.security;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Two traders must never see each other's books.
 *
 * Before these fixes the frontend sent no identity at all, so every request
 * resolved to the same fallback account and all traders shared one data set.
 */
class TenantIsolationIT extends AbstractSecurityIT {

    @Test
    @DisplayName("Each trader sees only their own farmers")
    void farmersAreScopedPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        long farmerA = createFarmer(tokenA, "Farmer of A");
        long farmerB = createFarmer(tokenB, "Farmer of B");

        assertNotEquals(farmerA, farmerB);

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Farmer of A"));

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Farmer of B"));
    }

    @Test
    @DisplayName("A trader cannot modify another trader's farmer by id")
    void crossTenantFarmerUpdateIsRejected() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        long farmerB = createFarmer(tokenB, "Farmer of B");

        mockMvc.perform(put("/api/farmers/" + farmerB)
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Hijacked", "village", "Elsewhere"))))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(tokenB)))
                .andExpect(jsonPath("$[0].name").value("Farmer of B"));
    }

    @Test
    @DisplayName("Purchases and their invoices are scoped per trader")
    void purchasesAreScopedPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        long farmerA = createFarmer(tokenA, "Farmer of A");
        long purchaseA = createPurchase(tokenA, farmerA, "PUR-A-001");

        mockMvc.perform(get("/api/purchases").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/purchases").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Trader B must not be able to open trader A's invoice by guessing the id.
        mockMvc.perform(get("/api/purchases/" + purchaseA).header("Authorization", bearer(tokenB)))
                .andExpect(status().isNotFound());

        // Nor record a payment against it.
        mockMvc.perform(post("/api/purchases/" + purchaseA + "/payments")
                        .header("Authorization", bearer(tokenB))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("amount", 100))))
                .andExpect(status().isNotFound());

        // Nor delete it.
        mockMvc.perform(delete("/api/purchases/" + purchaseA).header("Authorization", bearer(tokenB)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/purchases/" + purchaseA).header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Commodities are scoped per trader")
    void commoditiesAreScopedPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        mockMvc.perform(post("/api/commodities")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Cotton", "defaultRate", 7050.0))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/commodities").header("Authorization", bearer(tokenA)))
                .andExpect(jsonPath("$.length()").value(1));

        // This endpoint previously returned every commodity in the database.
        mockMvc.perform(get("/api/commodities").header("Authorization", bearer(tokenB)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("Stock adjustments are scoped, and cannot target another trader's commodity")
    void stockAdjustmentsAreScopedPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        MvcResult created = mockMvc.perform(post("/api/commodities")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Soybean", "defaultRate", 4800.0))))
                .andReturn();
        long commodityA = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("id").asLong();

        // Trader B may not attach an adjustment to trader A's commodity.
        mockMvc.perform(post("/api/stock-adjustments")
                        .header("Authorization", bearer(tokenB))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "commodityId", commodityA,
                                "weightQuintals", 50,
                                "type", "opening"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/stock-adjustments")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "commodityId", commodityA,
                                "weightQuintals", 50,
                                "type", "opening"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/stock-adjustments").header("Authorization", bearer(tokenA)))
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/stock-adjustments").header("Authorization", bearer(tokenB)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("Each trader has their own business profile")
    void businessProfileIsPerTrader() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        mockMvc.perform(post("/api/profile")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "A Traders", "gstin", "27AAAAA0000A1Z1"))))
                .andExpect(status().isOk());

        // Trader B's profile must be untouched by trader A's edit.
        mockMvc.perform(get("/api/profile").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessName").value("Trader B"));

        mockMvc.perform(get("/api/profile").header("Authorization", bearer(tokenA)))
                .andExpect(jsonPath("$.businessName").value("A Traders"))
                .andExpect(jsonPath("$.gstin").value("27AAAAA0000A1Z1"));
    }

    private long createPurchase(String token, long farmerId, String purchaseNumber) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/purchases")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "farmerId", farmerId,
                                "date", "2026-10-19",
                                "purchaseNumber", purchaseNumber,
                                "totalAmount", 50000.0,
                                "advancePaid", 10000.0,
                                "paymentMode", "Cash",
                                "items", List.of(Map.of(
                                        "commodityId", "other",
                                        "customCommodityName", "Cotton",
                                        "quantity", 10.0,
                                        "rate", 5000.0,
                                        "amount", 50000.0))))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("id").asLong();
    }
}
