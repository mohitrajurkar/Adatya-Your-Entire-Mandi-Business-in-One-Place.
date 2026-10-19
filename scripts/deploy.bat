@echo off
REM ========================================================
REM Adatya Production Build & Deploy Script (Windows)
REM ========================================================

echo ========================================================
echo  Adatya Production Build System
echo ========================================================

REM 1. Check/Prepare Environment Configuration
if not exist ".env" (
    if exist ".env.production.example" (
        echo [INFO] Creating .env from .env.production.example...
        copy .env.production.example .env >nul
    )
)

REM 2. Build Frontend
echo.
echo [1/2] Building React Frontend...
cd frontend
call npm install
call npm run build
cd ..

REM 3. Package Spring Boot Backend
echo.
echo [2/2] Packaging Spring Boot Backend JAR (Java 21 LTS)...
call mvn -f backend/pom.xml clean package -DskipTests -B

echo.
echo ========================================================
echo  BUILD SUCCESSFUL!
echo ========================================================
echo  Backend Executable : backend\target\adatya-backend-1.0.0.jar
echo  Frontend Assets    : frontend\dist\
echo.
echo  To run locally in production mode:
echo    java -jar backend\target\adatya-backend-1.0.0.jar
echo.
echo  To run full stack in Docker:
echo    docker compose up -d --build
echo ========================================================
