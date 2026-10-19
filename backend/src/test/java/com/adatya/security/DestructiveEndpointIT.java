package com.adatya.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for the two endpoints that could destroy the whole database.
 *
 *  - POST /api/account/delete called deleteAll() on every repository, including
 *    the users table, so one request erased every business on the platform.
 *  - POST /api/backup/import called deleteAll() across eight tables and then
 *    inserted caller-supplied rows under caller-supplied primary keys.
 */
class DestructiveEndpointIT extends AbstractSecurityIT {

    @Test
    @DisplayName("Deleting one account leaves every other account and its data intact")
    void accountDeletionIsScopedToTheOwner() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        createFarmer(tokenA, "Farmer of A");
        createFarmer(tokenB, "Farmer of B");

        assertEquals(2, userRepository.count());
        assertEquals(2, farmerRepository.count());

        mockMvc.perform(post("/api/account/delete")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", VALID_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Trader B must still exist, with their farmer.
        assertEquals(1, userRepository.count(), "Only the requesting account should be removed");
        assertEquals(1, farmerRepository.count(), "Only the requesting account's records should be removed");
        assertTrue(userRepository.findByMobile("9000000002").isPresent());

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Farmer of B"));
    }

    @Test
    @DisplayName("Account deletion requires the correct password, and the token identifies the account")
    void accountDeletionRequiresOwnPassword() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        registerAndLogin("9000000002", "Trader B");

        mockMvc.perform(post("/api/account/delete")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", "WrongPass123"))))
                .andExpect(status().isUnauthorized());

        assertEquals(2, userRepository.count());

        // A userId in the body is ignored; it used to select the target account.
        long traderBId = userRepository.findByMobile("9000000002").orElseThrow().getId();
        mockMvc.perform(post("/api/account/delete")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "userId", traderBId,
                                "password", VALID_PASSWORD))))
                .andExpect(status().isOk());

        // Trader B survived: the deletion applied to the token holder only.
        assertTrue(userRepository.findByMobile("9000000002").isPresent());
        assertTrue(userRepository.findByMobile("9000000001").isEmpty());
    }

    @Test
    @DisplayName("Backup export contains only the caller's own records")
    void exportIsScopedToTheCaller() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        createFarmer(tokenA, "Farmer of A");
        createFarmer(tokenB, "Farmer of B");

        MvcResult result = mockMvc.perform(get("/api/backup/export")
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        assertTrue(json.contains("Farmer of A"), "Own records should be exported");
        assertFalse(json.contains("Farmer of B"), "Another trader's records must not be exported");
        // The users table is no longer part of the export at all.
        assertFalse(json.contains("9000000002"), "Other accounts must not appear in the export");
    }

    @Test
    @DisplayName("Backup import refuses to run without the confirmation phrase")
    void importRequiresExplicitConfirmation() throws Exception {
        String token = registerAndLogin("9000000001", "Trader A");
        createFarmer(token, "Farmer of A");

        mockMvc.perform(post("/api/backup/import")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tables", Map.of()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // Nothing was deleted by the rejected request.
        assertEquals(1, farmerRepository.count());
    }

    @Test
    @DisplayName("An imported backup cannot overwrite another trader's rows by id")
    void importCannotTargetAnotherTenantById() throws Exception {
        String tokenA = registerAndLogin("9000000001", "Trader A");
        String tokenB = registerAndLogin("9000000002", "Trader B");

        long farmerB = createFarmer(tokenB, "Farmer of B");
        long traderBId = userRepository.findByMobile("9000000002").orElseThrow().getId();

        // A crafted file claiming trader B's farmer id and user id.
        String payload = objectMapper.writeValueAsString(Map.of(
                "confirm", "RESTORE",
                "tables", Map.of(
                        "farmers", java.util.List.of(Map.of(
                                "id", farmerB,
                                "userId", traderBId,
                                "name", "Injected Farmer",
                                "village", "Nowhere",
                                "mobile", "7000000000",
                                "outstandingBalance", 0.0)))));

        mockMvc.perform(post("/api/backup/import")
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        // Trader B's farmer is unchanged; the imported row landed in trader A.
        var preserved = farmerRepository.findById(farmerB).orElseThrow();
        assertEquals("Farmer of B", preserved.getName(), "Another tenant's row must not be overwritten");
        assertEquals(traderBId, preserved.getUserId());

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(tokenA)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Injected Farmer"));
    }
}
