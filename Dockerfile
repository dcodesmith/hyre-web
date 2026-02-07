# STAGE 1: Build
FROM node:22.12.0-bookworm-slim AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Enable corepack (uses pnpm version from packageManager field)
RUN corepack enable pnpm

# Copy lockfiles first for optimal caching
COPY package.json pnpm-lock.yaml ./

# Fetch dependencies
RUN pnpm fetch

# Copy source
COPY . .

# Install dependencies offline
RUN pnpm install --offline --frozen-lockfile

# Build the Remix app (prisma generate runs as part of build script)
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod --ignore-scripts && cp -R node_modules /tmp/node_modules_prod


# STAGE 2: Production
FROM node:22.12.0-bookworm-slim AS production

WORKDIR /app

# Install curl for healthchecks & openssl for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends curl openssl && rm -rf /var/lib/apt/lists/*

# Copy production essentials from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /tmp/node_modules_prod ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY --from=builder /app/entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Expose the Remix port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/ || exit 1

# Run as non-root user
USER node

# Start with entrypoint
CMD ["./entrypoint.sh"]
