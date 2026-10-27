package com.adatya.config;

import com.adatya.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Map;

/**
 * Deny-by-default HTTP security.
 *
 * Previously this chain ended in permitAll() for every path, which left the
 * whole API, including the admin and backup endpoints, open to anonymous
 * callers. Now only login, registration and the container health probe are
 * public; everything else requires a signed token, and the admin endpoints
 * additionally require the SUPER_ADMIN role.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsConfigurationSource corsConfigurationSource;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          CorsConfigurationSource corsConfigurationSource,
                          ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.corsConfigurationSource = corsConfigurationSource;
        this.objectMapper = objectMapper;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            // Safe to disable: authentication is a bearer token supplied in the
            // Authorization header, never an ambiently-sent cookie, so there is
            // no cross-site request forgery surface to protect.
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(handling -> handling
                .authenticationEntryPoint(unauthorizedEntryPoint())
                .accessDeniedHandler(forbiddenHandler())
            )
            .authorizeHttpRequests(auth -> auth
                // Public: obtaining a token, container health probe, and API documentation.
                .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Platform administration is restricted to the platform owner.
                .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")

                // Remaining operational actuator endpoints are not public.
                .requestMatchers("/actuator/**").hasRole("SUPER_ADMIN")

                // Everything else requires a valid token.
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Returns JSON 401 instead of redirecting to an HTML login form. */
    @Bean
    public AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, authException) -> writeJson(
                response,
                HttpServletResponse.SC_UNAUTHORIZED,
                "Please sign in to continue");
    }

    @Bean
    public AccessDeniedHandler forbiddenHandler() {
        return (request, response, accessDeniedException) -> writeJson(
                response,
                HttpServletResponse.SC_FORBIDDEN,
                "You do not have permission to perform this action");
    }

    private void writeJson(HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getOutputStream(),
                Map.of("success", false, "error", message));
    }

    @Bean
    public org.springframework.boot.web.servlet.FilterRegistrationBean<org.springframework.web.filter.OncePerRequestFilter> securityHeadersFilter() {
        org.springframework.boot.web.servlet.FilterRegistrationBean<org.springframework.web.filter.OncePerRequestFilter> registrationBean =
                new org.springframework.boot.web.servlet.FilterRegistrationBean<>();
        registrationBean.setFilter(new org.springframework.web.filter.OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,
                                            jakarta.servlet.http.HttpServletResponse response,
                                            jakarta.servlet.FilterChain filterChain) throws java.io.IOException, jakarta.servlet.ServletException {
                // Content Security Policy
                response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.example.com");
                // HSTS (1 year)
                response.setHeader("Strict-Transport-Security", "max-age=31536000 ; includeSubDomains");
                // Clickjacking protection
                response.setHeader("X-Frame-Options", "DENY");
                // MIME type sniffing protection
                response.setHeader("X-Content-Type-Options", "nosniff");
                filterChain.doFilter(request, response);
            }
        });
        registrationBean.setOrder(1);
        registrationBean.addUrlPatterns("/*");
        return registrationBean;
    }
}

