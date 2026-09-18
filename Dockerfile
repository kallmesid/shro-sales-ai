# Multi-stage Dockerfile for SHRO Cost Sheet Management System
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite frontend and bundle server
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled frontend assets & bundled server from builder stage
COPY --from=builder /app/dist ./dist

# Create persistence directories for database and uploaded documents
RUN mkdir -p /app/data/postgres /app/uploads

# Expose HTTP port 3000
EXPOSE 3000

# Declare persistent volumes
VOLUME ["/app/data", "/app/uploads"]

# Start production server
CMD ["node", "dist/server.cjs"]
