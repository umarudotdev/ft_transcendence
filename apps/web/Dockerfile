# syntax=docker/dockerfile:1

# Base stage with Bun for package management
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies stage
FROM base AS install

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install dependencies (skip prepare script - no git in container)
RUN bun install --frozen-lockfile --ignore-scripts

# Development stage - use Node.js for Vite 7 compatibility
FROM node:22-alpine AS development
WORKDIR /usr/src/app

# Install Bun for package management
RUN npm install -g bun

COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/web/node_modules ./apps/web/node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web

# Generate SvelteKit types
RUN bun run svelte-kit sync

EXPOSE 5173/tcp
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage - use Node.js for Vite 7 compatibility
FROM node:22-alpine AS build
WORKDIR /usr/src/app

# Install Bun for package management
RUN npm install -g bun

COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/web/node_modules ./apps/web/node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web

# Generate SvelteKit types
RUN bun run svelte-kit sync

ENV NODE_ENV=production
RUN bun run build

# Production stage - use Bun runtime for svelte-adapter-bun output
FROM oven/bun:1-alpine AS production
WORKDIR /app
COPY --from=build /usr/src/app/apps/web/build ./build
COPY --from=build /usr/src/app/apps/web/package.json ./

USER bun
ENV NODE_ENV=production
EXPOSE 3000/tcp
CMD ["bun", "./build/index.js"]
