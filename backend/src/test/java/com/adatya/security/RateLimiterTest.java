package com.adatya.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {

    private LoginRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter = new LoginRateLimiter();
    }

    @Test
    @DisplayName("Caller is not blocked initially or during first 4 failed attempts")
    void notBlockedInitially() {
        String key = "9876543210|192.168.1.100";
        assertFalse(rateLimiter.isBlocked(key));

        for (int i = 0; i < 4; i++) {
            rateLimiter.recordFailure(key);
            assertFalse(rateLimiter.isBlocked(key));
        }
    }

    @Test
    @DisplayName("Caller is blocked on 5th failed attempt and reports a positive retryAfterSeconds")
    void blockedOnFifthFailure() {
        String key = "9876543210|192.168.1.100";

        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailure(key);
        }

        assertTrue(rateLimiter.isBlocked(key));
        assertTrue(rateLimiter.retryAfterSeconds(key) > 0);
        assertTrue(rateLimiter.retryAfterSeconds(key) <= 900); // 15-minute sliding window
    }

    @Test
    @DisplayName("Successful login clears failure count and unblocks the key")
    void successClearsFailureCount() {
        String key = "9876543210|192.168.1.100";

        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailure(key);
        }
        assertTrue(rateLimiter.isBlocked(key));

        rateLimiter.recordSuccess(key);
        assertFalse(rateLimiter.isBlocked(key));
    }

    @Test
    @DisplayName("Rate limits are isolated per mobile and client address key")
    void limitsAreIsolatedBetweenCallers() {
        String attackerKey = "9000000001|10.0.0.1";
        String legitimateKey = "9000000002|10.0.0.2";

        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailure(attackerKey);
        }

        assertTrue(rateLimiter.isBlocked(attackerKey));
        assertFalse(rateLimiter.isBlocked(legitimateKey));
    }
}
