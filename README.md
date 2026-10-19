# Adatya — Agricultural Procurement & Mandi Ledger

Full-stack agricultural commodity procurement, farmer ledger, grain inventory, and billing application with clean separation of frontend and backend.

---

## Tech Stack

- **Frontend (`frontend/`)**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend (`backend/`)**: Java 25, Spring Boot 3.3.4, Spring Data JPA, Hibernate, Jackson, Maven
- **Database**: PostgreSQL (Auto-migration, DDL Update, Automated Seeding)

---

## Architecture Overview

```
Adatya/
├── frontend/                            # React Frontend (Vite + TypeScript)
│   ├── src/                             # Source code (components, pages, layouts, context, lib)
│   │   ├── components/                  # Modals, Navbar, Grain Badges, Receipts
│   │   ├── pages/                       # Dashboard, Purchases, Mandi Sales, Farmers, etc.
│   │   ├── layouts/                     # Dashboard & Layout wrappers
│   │   ├── context/                     # Language & Theme contexts
│   │   └── lib/                         # PDF generator, formatters, utilities
│   ├── public/                          # Static icons, manifest, PWA assets
│   ├── package.json                     # Frontend dependencies & scripts
│   ├── tsconfig.json                    # TypeScript configuration
│   └── vite.config.ts                   # Vite config with /api proxy to Spring Boot
├── backend/                             # Java Spring Boot Backend
│   ├── pom.xml                          # Maven build configuration
│   ├── src/main/java/com/adatya/
│   │   ├── AdatyaApplication.java       # Spring Boot main runner
│   │   ├── config/                      # CORS & DataInitializer seeds
│   │   ├── model/                       # JPA Entities (User, Farmer, Purchase, etc.)
│   │   ├── repository/                  # Spring Data JPA Repositories
│   │   └── controller/                  # REST Controllers (/api/*)
│   └── src/main/resources/
│       └── application.properties       # PostgreSQL connection & JPA settings
├── scripts/                             # Deployment & DB backup automation
├── package.json                         # Root workspace runner scripts
├── nginx.conf                           # Production reverse-proxy config
└── render.yaml                          # Render Cloud deployment blueprint
```

---

## Prerequisites

1. **Java Development Kit (JDK 25+)**
2. **Apache Maven (3.9+)**
3. **PostgreSQL (16+ / 17)** running locally on port `5432`
4. **Node.js (18+)** and npm

---

## Database Configuration

The backend connects to PostgreSQL at `localhost:5432`.
Default database name: `adatya_db`.

You can configure credentials via environment variables or in [backend/src/main/resources/application.properties](file:///c:/Users/mohit/Downloads/Adatya/backend/src/main/resources/application.properties):

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/adatya_db
spring.datasource.username=postgres
spring.datasource.password=postgres
```

The database tables are automatically initialized and seeded on first launch with:
- Default commodities (Cotton, Soybean, Moong, Wheat, Gram, Tur)
- Default Mandi Purchaser profile (`Bodhale Purchaser`)
- Default Admin account:
  - **Mobile**: `8805978780`
  - **Password**: `1234`

---

## Running the Application

### Option A: From Root (Convenience Scripts)

1. **Start Backend**:
   ```bash
   npm run dev:backend
   ```
2. **Start Frontend**:
   ```bash
   npm run dev:frontend
   ```

### Option B: Running Directly in Separate Folders

1. **Start Backend** (Port 8080):
   ```bash
   cd backend
   mvn spring-boot:run
   ```
   Or run the packaged jar:
   ```bash
   java -jar target/adatya-backend-1.0.0.jar
   ```

2. **Start Frontend** (Port 5173):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The React app will be live at `http://localhost:5173`, with `/api` proxying to `http://localhost:8080`.

---

## Production Deployment

For full deployment instructions (Systemd service, Nginx reverse proxy, SSL/Certbot, Render/Railway, backups), see [DEPLOYMENT.md](file:///c:/Users/mohit/Downloads/Adatya/DEPLOYMENT.md).

### 1. Build Frontend Static Assets
```bash
npm run build:frontend
# or: cd frontend && npm run build
```
This outputs minified production static assets into `frontend/dist/` ready to be served by Nginx, Apache, Vercel, or Netlify.

### 2. Package Spring Boot Backend JAR
```bash
npm run build:backend
# or: cd backend && mvn clean package -DskipTests
```
This produces `backend/target/adatya-backend-1.0.0.jar`.

### 3. Run Backend in Production
```bash
export DB_URL=jdbc:postgresql://<DB_HOST>:5432/adatya_db
export DB_USERNAME=<DB_USER>
export DB_PASSWORD=<DB_PASS>
export HIBERNATE_DDL_AUTO=update
export CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

java -jar backend/target/adatya-backend-1.0.0.jar
```
Or run using `npm run start:backend`.
