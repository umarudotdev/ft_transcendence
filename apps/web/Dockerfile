# syntax=docker/dockerfile:1

# Base stage with Node (better Vite 7 compatibility)
FROM node:22-alpine AS base
WORKDIR /usr/src/app

# Install bun for faster dependency installation
RUN npm install -g bun

# Install dependencies stage
FROM base AS install

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install dependencies (skip prepare script - no git in container)
RUN bun install --ignore-scripts

# Development stage
FROM base AS development
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/web/node_modules ./apps/web/node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web

# Generate SvelteKit types
RUN ./node_modules/.bin/svelte-kit sync

EXPOSE 5173/tcp
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
FROM base AS build
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/apps/web/node_modules ./apps/web/node_modules
COPY --from=install /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web

# Generate SvelteKit types
RUN ./node_modules/.bin/svelte-kit sync

ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /usr/src/app/apps/web/build ./build
COPY --from=build /usr/src/app/apps/web/package.json ./

ENV NODE_ENV=production
EXPOSE 3000/tcp
CMD ["node", "./build"]
