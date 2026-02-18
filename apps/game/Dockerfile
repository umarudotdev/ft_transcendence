# syntax=docker/dockerfile:1

# Base stage with Bun
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies stage
FROM base AS install

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY apps/game/package.json ./apps/game/

# Install dependencies (skip prepare script - no git in container)
RUN bun install --ignore-scripts

# Development stage
FROM base AS development
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/game/node_modules ./apps/game/node_modules
COPY . .

WORKDIR /usr/src/app/apps/game

USER bun
EXPOSE 2567/tcp
CMD ["bun", "run", "dev"]

# Production stage
FROM base AS production
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/game/node_modules ./apps/game/node_modules
COPY apps/game ./apps/game

WORKDIR /usr/src/app/apps/game

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
USER bun
EXPOSE 2567/tcp

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:2567/health || exit 1

CMD ["bun", "run", "src/app.config.ts"]
