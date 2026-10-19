# ==========================================
# Stage 1: Build Frontend React SPA
# ==========================================
FROM node:22-alpine AS build
WORKDIR /app

# Copy dependency manifests from frontend subdirectory
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and compile Vite build
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:alpine

# Remove default nginx HTML and configuration
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy production static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy root Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
