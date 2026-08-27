# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json        ./
COPY drizzle.config.ts    ./
COPY src/                 ./src/

RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# ffmpeg is required for video thumbnail generation (Phase 6).
# Safe to remove if thumbnail worker is not being deployed.
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy migrations folder for running database migrations in production
COPY --from=builder /app/src/db/migrations/ ./src/db/migrations/

ENV NODE_ENV=production

USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
