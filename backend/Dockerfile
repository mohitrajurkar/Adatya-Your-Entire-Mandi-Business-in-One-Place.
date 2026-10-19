# ==========================================
# Build Stage: Maven & Java 21 JDK
# ==========================================
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependency layer
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source and build executable JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==========================================
# Runtime Stage: Eclipse Temurin JRE 21
# ==========================================
FROM eclipse-temurin:21-jre
WORKDIR /app

# Non-root user for enhanced security
RUN groupadd -r adatya && useradd -r -g adatya adatya

# Copy built JAR from builder stage
COPY --from=build --chown=adatya:adatya /app/target/adatya-backend-*.jar app.jar

USER adatya

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
