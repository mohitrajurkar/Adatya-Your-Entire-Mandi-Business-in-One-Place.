package com.adatya.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Cross-origin policy.
 *
 * Credentials are deliberately NOT allowed: Adatya authenticates with a bearer
 * token that the frontend attaches explicitly, so the browser never needs to
 * send cookies cross-origin. The previous configuration combined
 * allowCredentials(true) with a wildcard origin fallback, which reflects any
 * requesting origin back and would let any website call the API on behalf of a
 * signed-in user.
 */
@Configuration
public class CorsConfig {

    private static final Logger log = LoggerFactory.getLogger(CorsConfig.class);

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(false);

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        if (origins.isEmpty()) {
            log.warn("cors.allowed-origins is empty; no cross-origin browser requests will be accepted. "
                   + "Set CORS_ALLOWED_ORIGINS if the frontend is served from a different origin.");
            config.setAllowedOrigins(List.of());
        } else if (origins.contains("*")) {
            // Permitted only because credentials are disabled above.
            log.warn("cors.allowed-origins is set to a wildcard. Configure the exact frontend "
                   + "origin(s) in CORS_ALLOWED_ORIGINS for production deployments.");
            config.setAllowedOriginPatterns(List.of("*"));
        } else {
            config.setAllowedOrigins(origins);
        }

        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
