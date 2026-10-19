package com.adatya.security;

import com.adatya.model.User;
import com.adatya.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Shared setup for the security and tenant-isolation tests: a real application
 * context, a real filter chain, and helpers that obtain genuine tokens through
 * the login endpoint rather than stubbing authentication.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractSecurityIT {

    protected static final String VALID_PASSWORD = "Testpass123";

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected FarmerRepository farmerRepository;

    @Autowired
    protected PurchaseRepository purchaseRepository;

    @Autowired
    protected CommodityRepository commodityRepository;

    @Autowired
    protected BusinessProfileRepository profileRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetDatabase() {
        farmerRepository.deleteAll();
        purchaseRepository.deleteAll();
        commodityRepository.deleteAll();
        profileRepository.deleteAll();
        userRepository.deleteAll();
    }

    /** Registers a trader through the public endpoint and returns their token. */
    protected String registerAndLogin(String mobile, String businessName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", businessName,
                                "businessName", businessName,
                                "mobile", mobile,
                                "password", VALID_PASSWORD))))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        if (!body.path("success").asBoolean()) {
            throw new IllegalStateException("Registration failed: " + body.path("error").asText());
        }
        return body.path("token").asText();
    }

    /** Creates an account with a given role directly, then signs in as it. */
    protected String createUserWithRoleAndLogin(String mobile, String name, String role) throws Exception {
        User user = new User();
        user.setName(name);
        user.setBusinessName(name);
        user.setApmcLocation("APMC Yard");
        user.setMobile(mobile);
        user.setRole(role);
        user.setPassword(passwordEncoder.encode(VALID_PASSWORD));
        userRepository.save(user);
        return login(mobile, VALID_PASSWORD);
    }

    protected String login(String mobile, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mobile", mobile,
                                "password", password))))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        if (!body.path("success").asBoolean()) {
            throw new IllegalStateException("Login failed: " + body.path("error").asText());
        }
        return body.path("token").asText();
    }

    protected String bearer(String token) {
        return "Bearer " + token;
    }

    /** Creates a farmer for the token holder and returns the new farmer id. */
    protected long createFarmer(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/farmers")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", name,
                                "village", "Test Village",
                                "mobile", "8000000000"))))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("id").asLong();
    }
}
