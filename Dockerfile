# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-slim AS backend-builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/prisma ./prisma/
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# Stage 3: Final Production Image
FROM node:20-slim
RUN apt-get update && apt-get install -y openssl sqlite3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy Backend artifacts
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=backend-builder /app/backend/prisma ./prisma

# Copy Frontend static files
# The backend expects ../../frontend/dist relative to dist/index.js
# /app/dist/index.js -> /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment configuration
# Note: You should still provide JWT secrets and ENCRYPTION_KEY at runtime
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Apply versioned migrations on startup
# Then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
