package com.adatya.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {"Testpass123", "a1bcdefg", "LongerPassword2026", "9876543a"})
    @DisplayName("Passwords meeting the policy are accepted")
    void acceptablePasswords(String password) {
        assertNull(PasswordPolicy.validate(password));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "1234",         // the previous 4-character minimum
            "abc1",
            "short1",
            "12345678",     // digits only
            "password",     // letters only
            "       "       // blank
    })
    @DisplayName("Weak passwords are rejected with a usable message")
    void weakPasswords(String password) {
        String problem = PasswordPolicy.validate(password);
        assertNotNull(problem, "Expected rejection for: " + password);
        assertFalse(problem.isBlank());
    }

    @Test
    @DisplayName("Null and over-long passwords are rejected")
    void boundaryCases() {
        assertNotNull(PasswordPolicy.validate(null));
        assertNotNull(PasswordPolicy.validate("a1" + "x".repeat(PasswordPolicy.MAX_LENGTH)));
    }
}
