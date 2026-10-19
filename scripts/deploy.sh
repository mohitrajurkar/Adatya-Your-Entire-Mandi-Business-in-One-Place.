#!/bin/bash
# ========================================================
# Adatya Production Build & Deployment Script (Linux/macOS)
# ========================================================

set -e

echo "========================================================"
echo "🚀 Starting Adatya Production Build..."
echo "========================================================"

# 1. Pull latest changes if in git
if [ -d ".git" ]; then
    echo "📦 Pulling latest changes from git repository..."
    git pull origin main || true
fi

# 2. Check environment configuration
if [ ! -f ".env" ] && [ -f ".env.production.example" ]; then
    echo "⚠️ .env file not found. Initializing from .env.production.example..."
    cp .env.production.example .env
fi

if [ ! -f "frontend/.env" ] && [ -f "frontend/.env.production.example" ]; then
    cp frontend/.env.production.example frontend/.env
fi

# 3. Build React Frontend
echo ""
echo "📦 [1/2] Building React 19 Frontend..."
cd frontend
npm ci || npm install
npm run build
cd ..

# 4. Package Spring Boot JAR
echo ""
echo "☕ [2/2] Packaging Spring Boot Backend JAR (Java 21 LTS)..."
mvn -f backend/pom.xml clean package -DskipTests -B

echo ""
echo "========================================================"
echo "✅ Build completed successfully!"
echo "========================================================"
echo "➡️ Backend JAR: backend/target/adatya-backend-1.0.0.jar"
echo "➡️ Frontend Assets: frontend/dist/"
echo ""
echo "Deployment Options:"
echo "1. Run Native Backend:"
echo "   java -jar backend/target/adatya-backend-1.0.0.jar"
echo ""
echo "2. Run Complete Stack with Docker:"
echo "   docker compose up -d --build"
echo "========================================================"
