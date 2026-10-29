package com.adatya.migration;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves a database built only from the migrations is one the application can
 * actually run against.
 *
 * This is the test that was missing. The ordinary suite runs on H2 with
 * flyway.enabled=false and ddl-auto=create-drop, so Hibernate builds the schema
 * from the entities themselves. Entity and migration can therefore disagree
 * indefinitely without a single test going red -- and they did. V1 never
 * created business_profile.mobile1 or mobile2, every existing database already
 * had the columns, and nothing noticed until a clean deployment refused to
 * start:
 *
 *     Schema-validation: missing column [mobile1] in table [business_profile]
 *
 * The check here is simply that the context loads. With Flyway on and
 * ddl-auto=validate, Hibernate compares every mapped entity against the real
 * migrated schema at startup and refuses to come up if anything is missing, so
 * the drift becomes a failing test instead of a failed deployment.
 *
 * It needs a real PostgreSQL: the migrations use PL/pgSQL and partial indexes
 * that H2 cannot run, and testing against a database the application does not
 * use would prove very little. CI supplies one. Without MIGRATION_DB_URL the
 * test skips, so `mvn test` on a laptop stays as quick as it was.
 */
@SpringBootTest
@ActiveProfiles("migration-check")
@TestPropertySource(properties = {
        "spring.datasource.url=${MIGRATION_DB_URL}",
        "spring.datasource.username=${MIGRATION_DB_USER:postgres}",
        "spring.datasource.password=${MIGRATION_DB_PASSWORD:postgres}",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration",
        // The point of the exercise: Hibernate checks the migrated schema and
        // will not start if an entity maps something the migrations never made.
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
        // Keep the seeding out of it; this is about the schema.
        "DEFAULT_ADMIN_MOBILE=",
        "DEFAULT_ADMIN_PASSWORD=",
        "JWT_SECRET=migration-check-signing-secret-0123456789"
})
@EnabledIfEnvironmentVariable(
        named = "MIGRATION_DB_URL",
        matches = ".+",
        disabledReason = "Needs a PostgreSQL database; CI provides one via MIGRATION_DB_URL")
class MigrationSchemaIT {

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    @DisplayName("every entity matches the schema the migrations build")
    void entitiesMatchMigratedSchema() {
        // Reaching this point already means Hibernate validated every mapping
        // against the migrated database during startup. The query below is
        // here so the test fails loudly rather than vacuously if that
        // validation is ever switched off.
        Number tables = (Number) entityManager
                .createNativeQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
                .getSingleResult();

        assertThat(tables.intValue())
                .as("migrations should have created the application's tables")
                .isGreaterThan(5);
    }

    @Test
    @DisplayName("Flyway applied every migration it has")
    void allMigrationsApplied() {
        Number pending = (Number) entityManager
                .createNativeQuery("SELECT count(*) FROM flyway_schema_history WHERE success = false")
                .getSingleResult();

        assertThat(pending.intValue())
                .as("no migration should have been recorded as failed")
                .isZero();
    }
}
