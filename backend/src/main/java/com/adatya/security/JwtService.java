package com.adatya.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * Issues and verifies signed (HS256) stateless access tokens.
 *
 * The signing secret is NEVER hard-coded. It is read from the
 * JWT_SECRET environment variable (or security.jwt.secret property) and the
 * application refuses to start if it is missing or too short to be safe.
 */
@Service
public class JwtService {

    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey signingKey;
    private final long ttlSeconds;

    public JwtService(
            @Value("${security.jwt.secret:}") String secret,
            @Value("${security.jwt.ttl-minutes:720}") long ttlMinutes) {

        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET is not configured. Set the JWT_SECRET environment variable to a "
              + "random value of at least " + MIN_SECRET_BYTES + " characters before starting Adatya.");
        }

        byte[] keyBytes = secret.trim().getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                "JWT_SECRET is too short (" + keyBytes.length + " bytes). It must be at least "
              + MIN_SECRET_BYTES + " bytes to sign tokens safely.");
        }

        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.ttlSeconds = ttlMinutes * 60L;
    }

    /** Mints an access token identifying the given account. */
    public String issueToken(Long userId, String mobile, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("mobile", mobile)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Verifies the signature and expiry of a token.
     *
     * @return the token claims, or null when the token is absent, malformed,
     *         expired or not signed by this server.
     */
    public Claims verifyToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public long getTtlSeconds() {
        return ttlSeconds;
    }
}
