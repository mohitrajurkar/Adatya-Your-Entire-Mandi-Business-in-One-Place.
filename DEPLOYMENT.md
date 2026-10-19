# 🚀 Adatya AWS EC2 & Production Deployment Guide

This guide provides end-to-end instructions for deploying the **Adatya** agricultural commodity procurement and mandi ledger platform across production environments, with a primary focus on **AWS EC2 containerized deployment with Docker Compose**.

---

## 🏗️ Production Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │            Client Web Browser                │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTP / HTTPS (Ports 80 / 443)
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    AWS EC2 Instance (Security Group)         │
                      │  - Port 80 (HTTP) -> 0.0.0.0/0               │
                      │  - Port 443 (HTTPS) -> 0.0.0.0/0             │
                      │  - Port 22 (SSH) -> YOUR_IP/32 only          │
                      │  - Port 5432 (Postgres) -> NOT EXPOSED       │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
  ┌───────────────────────────────── Docker Network ─────────────────────────────────┐
  │                                                                                  │
  │   ┌──────────────────────────────────────────────────────────────────────────┐   │
  │   │           Nginx Web Server Container (adatya-frontend:80)                │   │
  │   │  - Serves compiled React 19 SPA static assets (/dist)                    │   │
  │   │  - SPA client routing fallback (try_files $uri $uri/ /index.html)       │   │
  │   │  - Gzip compression & production security headers                       │   │
  │   │  - Health probe endpoint: /healthz                                       │   │
  │   └──────────────────────┬───────────────────────────────────────────────────┘   │
  │                          │ Reverse Proxy /api/ & /actuator/                      │
  │                          ▼                                                       │
  │   ┌──────────────────────────────────────────────────────────────────────────┐   │
  │   │          Spring Boot 3.3.4 Backend Container (adatya-backend:8080)       │   │
  │   │  - Eclipse Temurin JRE 21 LTS runtime (non-root user)                    │   │
  │   │  - REST API (/api/*) & Actuator probes (/actuator/health)                │   │
  │   │  - HikariCP database connection pool & BCrypt security                   │   │
  │   └──────────────────────┬───────────────────────────────────────────────────┘   │
  │                          │                                                       │
  │                          │ JDBC: jdbc:postgresql://database:5432/adatya_db       │
  │                          ▼                                                       │
  │   ┌──────────────────────────────────────────────────────────────────────────┐   │
  │   │       PostgreSQL 16 Alpine Container (adatya-database:5432)              │   │
  │   │  - Persistent named Docker volume: adatya_postgres_data                  │   │
  │   │  - Internal network only (NEVER bound to host public ports)              │   │
  │   │  - Health check via pg_isready                                           │   │
  │   └──────────────────────────────────────────────────────────────────────────┘   │
  │                                                                                  │
  └──────────────────────────────────────────────────────────────────────────────────┘
                                             │ (Alternative Managed Option)
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    AWS RDS PostgreSQL 16 (Managed DB)        │
                      │  - Subnet group inside VPC private subnet    │
                      │  - Auto-backups, multi-AZ, read replicas     │
                      │  - Connected via DB_URL environment variable │
                      └──────────────────────────────────────────────┘
```

---

## ☁️ Part 1: AWS EC2 Deployment with Docker Compose

Follow these exact steps to set up and deploy Adatya on an AWS EC2 instance.

### 1. Provision AWS EC2 Instance

1. Log into your **AWS Management Console** and navigate to **EC2**.
2. Click **Launch Instance** with the following specifications:
   - **Name**: `adatya-production-server`
   - **AMI**: **Ubuntu Server 24.04 LTS** (or Amazon Linux 2023)
   - **Instance Type**: 
     - Recommended: `t3.small` (2 vCPU, 2 GB RAM) or `t3.medium` (2 vCPU, 4 GB RAM) for Docker builds.
     - Minimum: `t3.micro` (1 GB RAM) — *Note: If using `t3.micro`, you MUST add 2 GB of swap space as explained below to prevent the Java/Maven compiler from running out of memory during Docker build.*
   - **Storage**: Minimum `20 GB gp3` general purpose SSD.
   - **Key Pair**: Select or create a `.pem` key pair (e.g. `adatya-key.pem`).

---

### 2. Configure AWS EC2 Security Group

Create or edit your EC2 Security Group with the following firewall rules:

#### Inbound Rules:
| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | **`My IP`** (`<your-ip>/32`) | **Strictly restrict SSH to your IP address.** Never leave open to `0.0.0.0/0`. |
| **HTTP** | TCP | `80` | `0.0.0.0/0` (IPv4) & `::/0` (IPv6) | Public web traffic for Nginx frontend. |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` (IPv4) & `::/0` (IPv6) | Secure SSL/TLS encrypted traffic. |

> [!CAUTION]
> **Database Security**: Never add Port `5432` to the EC2 Inbound Rules. PostgreSQL is kept strictly internal to the private Docker bridge network.

#### Outbound Rules:
- **All Traffic**: Allow all outbound traffic (`0.0.0.0/0`) so the server can download packages and Docker images.

---

### 3. Connect to EC2 & Prepare Host Environment

Connect to your EC2 instance via SSH:
```bash
chmod 400 adatya-key.pem
ssh -i adatya-key.pem ubuntu@<your-ec2-public-ip>
```

#### A. Configure Swap Memory (Essential for `t3.micro` / `t3.small`):
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### B. Install Docker & Docker Compose:
On Ubuntu 24.04 LTS:
```bash
# 1. Update package index and install certificates
sudo apt update && sudo apt install -y ca-certificates curl gnupg git

# 2. Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine and Docker Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable Docker service and grant user permission
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 6. Apply group membership (or log out and back in)
newgrp docker
```

Verify installation:
```bash
docker --version
docker compose version
```

---

### 4. Clone Repository & Configure Environment Variables

```bash
# Clone the repository
git clone https://github.com/your-username/adatya.git
cd adatya

# Create production environment file from template
cp .env.production.example .env
```

Edit `.env` using your preferred editor:
```bash
nano .env
```

Set strong, random production values:
```properties
# Web Server
WEB_PORT=80

# Database Configuration (Containerized PostgreSQL)
POSTGRES_DB=adatya_db
DB_USERNAME=postgres
DB_PASSWORD=YOUR_SUPER_STRONG_DATABASE_PASSWORD_HERE

# JDBC URL
DB_URL=jdbc:postgresql://database:5432/adatya_db

# Hibernate Strategy
HIBERNATE_DDL_AUTO=update

# Initial Admin Credentials (Seeded on first startup)
DEFAULT_ADMIN_MOBILE=9356893989
DEFAULT_ADMIN_PASSWORD=YOUR_SECURE_ADMIN_PASSWORD_HERE

# CORS Configuration (Include your domain or public IP)
CORS_ALLOWED_ORIGINS=http://<your-ec2-ip>,https://yourdomain.com
```

> [!IMPORTANT]
> The `.env` file is already listed in `.gitignore` and `.dockerignore`. Never commit `.env` or raw passwords into version control.

---

### 5. Launch the Application Containers

Start all services in detached mode with automated builds:
```bash
docker compose up -d --build
```

#### Check Service Status:
```bash
docker compose ps
```
Expected output:
```
NAME               IMAGE               STATUS                    PORTS
adatya-database    postgres:16-alpine  Up (healthy)              5432/tcp
adatya-backend     adatya-backend      Up (healthy)              8080/tcp
adatya-frontend    adatya-frontend     Up (healthy)              0.0.0.0:80->80/tcp
```

#### Inspect Application Logs:
```bash
# Follow logs for all services
docker compose logs -f

# Follow backend startup and verify database migration
docker compose logs -f backend
```

---

### 6. Verify Deployment

1. **Frontend**: Open `http://<your-ec2-public-ip>` in your web browser. You should see the Adatya login interface.
2. **Backend Actuator Health**:
   ```bash
   curl -i http://localhost/actuator/health
   # Expected response: HTTP/1.1 200 OK {"status":"UP"}
   ```
3. **Nginx Health Check**:
   ```bash
   curl -i http://localhost/healthz
   # Expected response: HTTP/1.1 200 OK healthy
   ```
4. **API Proxy**:
   ```bash
   curl -i http://localhost/api/commodities
   # Expected response: JSON array of default commodities (Cotton, Soybean, etc.)
   ```

---

## 🗄️ Part 2: Using AWS RDS PostgreSQL (Managed Production Database)

For enterprise production deployments, using **AWS RDS for PostgreSQL** is strongly recommended over hosting the database inside an EC2 container. RDS provides automated daily snapshots, multi-AZ failover, automatic minor version patching, and independent storage scaling.

### 1. Provision RDS PostgreSQL Instance
- **Engine**: PostgreSQL 16
- **Template**: Free tier or Production (e.g. `db.t4g.micro` or `db.t4g.small`)
- **VPC**: Select the **same VPC** as your EC2 instance.
- **Public Access**: Select **No** (Database must stay private).
- **VPC Security Group**: Create an RDS security group with an Inbound Rule allowing **PostgreSQL (Port 5432)** with the Source set to your **EC2 Security Group ID** (e.g., `sg-0123456789abcdef`).
- **Initial Database Name**: `adatya_db`
- **Master Username**: `postgres`
- **Master Password**: Set a strong password.

### 2. Connect EC2 to AWS RDS
Once the RDS status becomes `Available`, copy the **RDS Endpoint** (e.g., `adatya-db.c123456789.us-east-1.rds.amazonaws.com`).

Update `.env` on your EC2 instance:
```properties
# Point DB_URL to the AWS RDS Endpoint
DB_URL=jdbc:postgresql://adatya-db.c123456789.us-east-1.rds.amazonaws.com:5432/adatya_db
DB_USERNAME=postgres
DB_PASSWORD=YOUR_RDS_MASTER_PASSWORD
```

### 3. Run Backend & Frontend without Containerized Database
```bash
# Stop and remove the local containerized database
docker compose stop database

# Launch only backend and frontend connected to RDS
docker compose up -d backend frontend
```

---

## 🔒 Part 3: Enabling SSL / HTTPS with Let's Encrypt (Certbot)

To secure traffic with HTTPS on port 443:

### Option 1: Host-Level Nginx Reverse Proxy with Certbot
1. Assign an **Elastic IP** to your EC2 instance and point your DNS `A` record (e.g. `adatya.yourdomain.com`) to this IP.
2. In `docker-compose.yml`, change frontend port mapping from `80:80` to `8080:80` or `127.0.0.1:8080:80`.
3. Install Nginx and Certbot on the EC2 host:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
4. Create `/etc/nginx/sites-available/adatya`:
   ```nginx
   server {
       listen 80;
       server_name adatya.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
5. Enable and issue certificate:
   ```bash
   sudo ln -s /etc/nginx/sites-available/adatya /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d adatya.yourdomain.com
   ```

### Option 2: AWS Application Load Balancer (ALB)
For production architectures:
1. Request a free SSL certificate in **AWS Certificate Manager (ACM)** for your domain.
2. Create an **Application Load Balancer (ALB)** in AWS with listeners:
   - Port 80 (HTTP) -> Redirects to HTTPS (Port 443).
   - Port 443 (HTTPS) -> Forwards to target group containing your EC2 instance on Port 80.
3. Attach the ACM certificate to the ALB.

---

## 🛠️ Part 4: Operational Maintenance & Automated Backups

### 1. Automated Daily PostgreSQL Backups
Add a cron job on your EC2 instance to dump the database daily to `/var/backups/adatya`:
```bash
sudo mkdir -p /var/backups/adatya
```
Create `/usr/local/bin/backup-adatya.sh`:
```bash
#!/usr/bin/env bash
set -e
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/adatya"
CONTAINER_NAME="adatya-database"

docker exec -t $CONTAINER_NAME pg_dump -U postgres -d adatya_db | gzip > "$BACKUP_DIR/adatya_db_$TIMESTAMP.sql.gz"

# Retain last 14 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -exec rm -f {} \;
```
Make executable and schedule in crontab (`sudo crontab -e`):
```bash
0 2 * * * /usr/local/bin/backup-adatya.sh >> /var/log/adatya_backup.log 2>&1
```

### 2. Updating Application with Zero Data Loss
When updating your code:
```bash
cd ~/adatya
git pull origin main
docker compose up -d --build
```
*Because database data is stored in the `adatya_postgres_data` persistent volume, your records are completely preserved across builds and container restarts.*

---

## 🔍 Part 5: Troubleshooting & FAQ

| Problem | Root Cause | Solution |
| :--- | :--- | :--- |
| `502 Bad Gateway` on web browser | Spring Boot backend is still compiling or booting up. | Wait ~30 seconds for backend health probe to turn green. Check `docker compose logs -f backend`. |
| Out of Memory (OOM) during `mvn clean package` | Server has less than 2 GB RAM and compiler exceeded available memory. | Configure 2 GB swap space using `fallocate` or upgrade instance to `t3.small` / `t3.medium`. |
| `database: Connection refused` | Backend started before PostgreSQL finished initialization. | Docker Compose uses `condition: service_healthy` with `pg_isready` to guarantee database readiness before backend starts. |
| Cannot connect via SSH (`Timeout`) | EC2 Security Group is blocking Port 22 or your public IP changed. | Edit the EC2 Security Group inbound rule for Port 22 to match your current public IP address. |
| Changes to `.env` not taking effect | Containers were not recreated with new environment values. | Run `docker compose up -d --force-recreate` to reload configuration. |
