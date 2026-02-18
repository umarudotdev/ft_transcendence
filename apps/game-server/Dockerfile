# syntax=docker/dockerfile:1

# Base stage with Bun
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies stage
FROM base AS install

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY apps/game-server/package.json ./apps/game-server/
COPY packages/supercluster/package.json ./packages/supercluster/

# Install dependencies (skip prepare script - no git in container)
RUN bun install --ignore-scripts

# Development stage
FROM base AS development
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/packages/supercluster/node_modules ./packages/supercluster/node_modules
COPY . .

# Re-resolve workspace symlinks now that full source is available
RUN bun install --ignore-scripts

WORKDIR /usr/src/app/apps/game-server

USER bun
EXPOSE 9944/tcp
CMD ["bun", "run", "dev"]
