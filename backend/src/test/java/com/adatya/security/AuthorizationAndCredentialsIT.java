package com.adatya.security;

import com.adatya.model.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Role enforcement, credential handling and registration hardening.
 */
class AuthorizationAndCredentialsIT extends AbstractSecurityIT {

    @Test
    @DisplayName("Admin endpoints are closed to ordinary traders and open to the platform owner")
    void adminEndpointsRequireSuperAdmin() throws Exception {
        String traderToken = registerAndLogin("9000000001", "Trader A");

        mockMvc.perform(get("/api/admin/businesses").header("Authorization", bearer(traderToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/overview").header("Authorization", bearer(traderToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/businesses/1").header("Authorization", bearer(traderToken)))
                .andExpect(status().isForbidden());

        String ownerToken = createUserWithRoleAndLogin("9000000009", "Platform Owner", "SUPER_ADMIN");

        mockMvc.perform(get("/api/admin/businesses").header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/overview").header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Registration cannot grant itself a privileged role")
    void registrationCannotSelfAssignRole() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Attacker",
                                "businessName", "Attacker Trading",
                                "mobile", "9000000003",
                                "password", VALID_PASSWORD,
                                "role", "SUPER_ADMIN"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals("ADMIN", body.path("user").path("role").asText(),
                "The server must assign the role, ignoring the request body");

        User stored = userRepository.findByMobile("9000000003").orElseThrow();
        assertEquals("ADMIN", stored.getRole());

        // And the resulting token must not open the admin endpoints.
        mockMvc.perform(get("/api/admin/businesses")
                        .header("Authorization", bearer(body.path("token").asText())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A plaintext password stored in the database no longer authenticates")
    void plaintextPasswordsAreRejected() throws Exception {
        User legacy = new User();
        legacy.setName("Legacy Account");
        legacy.setBusinessName("Legacy Traders");
        legacy.setMobile("9000000004");
        legacy.setRole("ADMIN");
        legacy.setPassword("plaintextpass1"); // not a BCrypt hash
        userRepository.save(legacy);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mobile", "9000000004",
                                "password", "plaintextpass1"))))
                .andExpect(status().isUnauthorized());

        // The stored value must not have been silently migrated either.
        assertEquals("plaintextpass1",
                userRepository.findByMobile("9000000004").orElseThrow().getPassword());
    }

    @Test
    @DisplayName("Weak passwords are refused at registration")
    void weakPasswordsAreRefused() throws Exception {
        for (String weak : new String[]{"1234", "pass", "password", "12345678"}) {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "name", "Weak",
                                    "businessName", "Weak Trading",
                                    "mobile", "9000000005",
                                    "password", weak))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.success").value(false));
        }

        assertTrue(userRepository.findByMobile("9000000005").isEmpty());
    }

    @Test
    @DisplayName("Repeated failed logins are throttled")
    void repeatedFailuresAreThrottled() throws Exception {
        registerAndLogin("9000000006", "Trader F");

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "mobile", "9000000006",
                                    "password", "WrongPass" + attempt))))
                    .andExpect(status().isUnauthorized());
        }

        // The sixth attempt is refused outright, even with the right password.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mobile", "9000000006",
                                "password", VALID_PASSWORD))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Changing a password requires the current one")
    void passwordChangeRequiresCurrentPassword() throws Exception {
        String token = registerAndLogin("9000000007", "Trader G");

        mockMvc.perform(post("/api/user/profile")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newPassword", "BrandNew123"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/user/profile")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "NotMyPassword1",
                                "newPassword", "BrandNew123"))))
                .andExpect(status().isUnauthorized());

        // The original password still works.
        assertNotNull(login("9000000007", VALID_PASSWORD));

        mockMvc.perform(post("/api/user/profile")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", VALID_PASSWORD,
                                "newPassword", "BrandNew123"))))
                .andExpect(status().isOk());

        assertNotNull(login("9000000007", "BrandNew123"));
    }

    @Test
    @DisplayName("A token stops working once its account is gone")
    void tokenDiesWithTheAccount() throws Exception {
        String token = registerAndLogin("9000000008", "Trader H");

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        userRepository.deleteAll();

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }
}
