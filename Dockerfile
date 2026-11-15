# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source code and configs
COPY tsconfig.json tsconfig.server.json tsconfig.web.json vite.config.ts ./
COPY public ./public
COPY src ./src

# Build server and web client
RUN npm run build

# ── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server and web client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Run as non-root user 'node'
USER node

EXPOSE 8080

CMD ["node", "dist/server/index.js"]
