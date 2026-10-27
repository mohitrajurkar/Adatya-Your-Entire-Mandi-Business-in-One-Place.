package com.adatya.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "unit-test-signing-secret-value-0123456789";

    @Test
    @DisplayName("A freshly issued token verifies and carries the account claims")
    void issuedTokenVerifies() {
        JwtService service = new JwtService(SECRET, 60);

        String token = service.issueToken(42L, "9000000001", "ADMIN");
        Claims claims = service.verifyToken(token);

        assertNotNull(claims);
        assertEquals("42", claims.getSubject());
        assertEquals("9000000001", claims.get("mobile"));
        assertEquals("ADMIN", claims.get("role"));
    }

    @Test
    @DisplayName("A token signed with a different secret is rejected")
    void foreignSignatureIsRejected() {
        String token = new JwtService("a-totally-different-secret-value-0123456789", 60)
                .issueToken(42L, "9000000001", "SUPER_ADMIN");

        assertNull(new JwtService(SECRET, 60).verifyToken(token));
    }

    @Test
    @DisplayName("Tampered, malformed, empty and expired tokens are rejected")
    void invalidTokensAreRejected() {
        JwtService service = new JwtService(SECRET, 60);
        String token = service.issueToken(42L, "9000000001", "ADMIN");

        // Alter a character in the PAYLOAD segment, which is covered by the
        // signature. Flipping the last character of the signature instead is
        // unreliable: base64url encodes 86 characters for a 64-byte HS512
        // signature, so the final character carries four unused bits and
        // changing it can decode to the very same bytes.
        String[] parts = token.split("\\.");
        assertEquals(3, parts.length, "A JWT has three segments");
        char middle = parts[1].charAt(0);
        parts[1] = (middle == 'a' ? 'b' : 'a') + parts[1].substring(1);
        String tampered = String.join(".", parts);

        assertNotEquals(token, tampered);
        assertNull(service.verifyToken(tampered));
        assertNull(service.verifyToken("not.a.token"));
        assertNull(service.verifyToken(""));
        assertNull(service.verifyToken(null));

        // A zero-minute lifetime means the token is already past its expiry.
        JwtService expiring = new JwtService(SECRET, 0);
        assertNull(expiring.verifyToken(expiring.issueToken(42L, "9000000001", "ADMIN")));
    }

    @Test
    @DisplayName("The service refuses to start without a strong secret")
    void weakSecretsAreRefused() {
        assertThrows(IllegalStateException.class, () -> new JwtService(null, 60));
        assertThrows(IllegalStateException.class, () -> new JwtService("", 60));
        assertThrows(IllegalStateException.class, () -> new JwtService("   ", 60));
        assertThrows(IllegalStateException.class, () -> new JwtService("too-short-secret", 60));
    }

    @Test
    @DisplayName("Stored role text is normalized onto a canonical role")
    void roleNormalization() {
        assertEquals("ADMIN", AuthenticatedUser.normalizeRole("Admin"));
        assertEquals("SUPER_ADMIN", AuthenticatedUser.normalizeRole("super_admin"));
        assertEquals("SUPER_ADMIN", AuthenticatedUser.normalizeRole("Super Admin"));
        assertEquals("ADMIN", AuthenticatedUser.normalizeRole(null));
        assertEquals("ADMIN", AuthenticatedUser.normalizeRole("  "));
    }
}
