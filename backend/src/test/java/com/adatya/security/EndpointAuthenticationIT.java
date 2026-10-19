package com.adatya.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The filter chain used to end in permitAll() for every path. These tests pin
 * the deny-by-default behaviour so it cannot regress silently.
 */
class EndpointAuthenticationIT extends AbstractSecurityIT {

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/farmers",
            "/api/purchases",
            "/api/commodities",
            "/api/mandi-sales",
            "/api/stock-adjustments",
            "/api/inventory/stock",
            "/api/dashboard",
            "/api/profile",
            "/api/backup/stats",
            "/api/backup/export",
            "/api/admin/overview",
            "/api/admin/businesses",
            "/api/auth/me"
    })
    @DisplayName("GET endpoints reject anonymous callers with 401")
    void anonymousGetsAreRejected(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("The destructive endpoints reject anonymous callers")
    void anonymousDestructiveCallsAreRejected() throws Exception {
        mockMvc.perform(post("/api/account/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"anything\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/backup/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm\":\"RESTORE\",\"tables\":{}}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("A forged or malformed token does not authenticate")
    void forgedTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/farmers")
                        .header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());

        // A token signed with a different key must not be accepted.
        String foreignToken = new JwtService(
                "a-completely-different-signing-secret-0123456789", 60)
                .issueToken(1L, "9000000001", "SUPER_ADMIN");

        mockMvc.perform(get("/api/farmers")
                        .header("Authorization", bearer(foreignToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("The X-User-Id header no longer grants any identity")
    void spoofedUserIdHeaderIsIgnored() throws Exception {
        String token = registerAndLogin("9000000001", "Trader One");
        long ownFarmer = createFarmer(token, "Own Farmer");

        // Previously this header selected the tenant outright.
        mockMvc.perform(get("/api/farmers").header("X-User-Id", "1"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/farmers").param("userId", "1"))
                .andExpect(status().isUnauthorized());

        // With a real token the caller still sees only their own records.
        mockMvc.perform(get("/api/farmers")
                        .header("Authorization", bearer(token))
                        .header("X-User-Id", "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(ownFarmer));
    }

    @Test
    @DisplayName("A valid token reaches the protected endpoints")
    void validTokenIsAccepted() throws Exception {
        String token = registerAndLogin("9000000001", "Trader One");

        mockMvc.perform(get("/api/farmers").header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mobile").value("9000000001"));
    }

    @Test
    @DisplayName("Login and health remain publicly reachable")
    void publicEndpointsStayPublic() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mobile", "9999999999", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }
}
