package com.adatya.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 / Swagger documentation configuration for Adatya API.
 * Configures JWT Bearer authentication globally for protected endpoints.
 */
@Configuration
public class OpenApiConfig {

    public static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI adatyaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Adatya — Agricultural Procurement & Mandi Ledger API")
                        .description("Production REST API documentation for Adatya financial tracking, farmer ledgers, "
                                + "commodity procurement, inventory management, payments, and mandi sales.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Adatya Platform Engineering")
                                .email("engineering@adatya.local"))
                        .license(new License().name("Proprietary").url("https://adatya.local")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter your signed JWT Bearer token obtained from /api/auth/login or /api/auth/register")));
    }
}
