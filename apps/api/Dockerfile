# syntax=docker/dockerfile:1

# Base stage with Bun
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies stage
FROM base AS install

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY apps/api/package.json ./apps/api/

# Install dependencies (skip prepare script - no git in container)
RUN bun install --ignore-scripts

# Development stage
FROM base AS development
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/api

# Create uploads directory with proper ownership before switching to bun user
RUN mkdir -p uploads/avatars && chown -R bun:bun uploads

USER bun
EXPOSE 3000/tcp
CMD ["bun", "run", "dev"]

# Production stage
FROM base AS production
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api

WORKDIR /usr/src/app/apps/api

# Create uploads directory with proper ownership before switching to bun user
RUN mkdir -p uploads/avatars && chown -R bun:bun uploads

ENV NODE_ENV=production
USER bun
EXPOSE 3000/tcp
CMD ["bun", "run", "src/index.ts"]
