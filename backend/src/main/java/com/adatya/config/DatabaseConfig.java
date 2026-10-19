package com.adatya.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
@Profile("!test")
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url:${DB_URL:${DATABASE_URL:jdbc:postgresql://localhost:5432/adatya_db}}}")
    private String rawUrl;

    @Value("${spring.datasource.username:${DB_USERNAME:postgres}}")
    private String username;

    @Value("${spring.datasource.password:${DB_PASSWORD:postgres}}")
    private String password;

    @Value("${spring.datasource.hikari.maximum-pool-size:${DB_POOL_MAX:10}}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:${DB_POOL_MIN:2}}")
    private int minIdle;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        String cleanUrl = rawUrl != null ? rawUrl.trim() : "";
        String resolvedUser = username;
        String resolvedPass = password;

        // Auto-adapt cloud PaaS connection strings (Render, Heroku, Railway, Supabase, Neon)
        if (cleanUrl.startsWith("postgres://") || cleanUrl.startsWith("postgresql://")) {
            try {
                String standardUriStr = cleanUrl.startsWith("postgres://")
                        ? "http://" + cleanUrl.substring("postgres://".length())
                        : "http://" + cleanUrl.substring("postgresql://".length());
                URI uri = URI.create(standardUriStr);

                String host = uri.getHost();
                int port = uri.getPort() != -1 ? uri.getPort() : 5432;
                String path = uri.getPath() != null && !uri.getPath().isBlank() ? uri.getPath() : "/adatya_db";
                if (!path.startsWith("/")) {
                    path = "/" + path;
                }

                if (uri.getUserInfo() != null && !uri.getUserInfo().isBlank()) {
                    String[] userInfo = uri.getUserInfo().split(":", 2);
                    resolvedUser = userInfo[0];
                    if (userInfo.length > 1) {
                        resolvedPass = userInfo[1];
                    }
                }

                String query = uri.getQuery() != null && !uri.getQuery().isBlank() ? "?" + uri.getQuery() : "";
                cleanUrl = "jdbc:postgresql://" + host + ":" + port + path + query;
                log.info("Auto-converted cloud PostgreSQL URI to JDBC URL: jdbc:postgresql://{}:{}{}", host, port, path);
            } catch (Exception e) {
                log.warn("Failed to parse URI structured connection string, attempting prefix replacement: {}", e.getMessage());
                if (cleanUrl.startsWith("postgres://")) {
                    cleanUrl = "jdbc:postgresql://" + cleanUrl.substring("postgres://".length());
                } else if (cleanUrl.startsWith("postgresql://")) {
                    cleanUrl = "jdbc:postgresql://" + cleanUrl.substring("postgresql://".length());
                }
            }
        }

        config.setJdbcUrl(cleanUrl);
        config.setUsername(resolvedUser);
        config.setPassword(resolvedPass);
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setIdleTimeout(300000);
        config.setConnectionTimeout(30000);
        config.setMaxLifetime(1800000);

        return new HikariDataSource(config);
    }
}
