import cors from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { logger } from "./common/logger";
import { errorHandler } from "./common/plugins/error-handler";
import { loggingPlugin } from "./common/plugins/logging";
import { shutdownManager } from "./common/shutdown";
import { env } from "./env";
import { authController } from "./modules/auth/auth.controller";
import { chatController } from "./modules/chat/chat.controller";
import { gamificationController } from "./modules/gamification/gamification.controller";
import { matchmakingController } from "./modules/matchmaking/matchmaking.controller";
import { moderationController } from "./modules/moderation/moderation.controller";
import { notificationsController } from "./modules/notifications/notifications.controller";
import { rankingsController } from "./modules/rankings/rankings.controller";
import { statusController } from "./modules/status/status.controller";
import { usersController } from "./modules/users/users.controller";

/**
 * Build allowed CORS origins from environment configuration.
 * In development, localhost origins are automatically added.
 * In production, only explicitly configured origins are allowed.
 */
function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // Always add the configured frontend URL
  origins.add(env.FRONTEND_URL);

  // Add any additional CORS origins from environment (comma-separated)
  if (env.CORS_ORIGINS) {
    for (const origin of env.CORS_ORIGINS.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }

  // In development, add localhost variants for convenience
  if (env.NODE_ENV === "development") {
    origins.add("http://localhost:5173");
    origins.add("http://localhost:5174");
    origins.add("http://127.0.0.1:5173");
    origins.add("http://127.0.0.1:5174");
  }

  return [...origins];
}

const ALLOWED_ORIGINS = getAllowedOrigins();

const app = new Elysia()
  .use(loggingPlugin)
  .use(errorHandler)
  .use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true, // Required for cookies
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 86400, // 24 hours preflight cache
    })
  )
  .use(
    openapi({
      documentation: {
        info: {
          title: "ft_transcendence API",
          version: "1.0.0",
          description:
            "Real-time multiplayer Pong platform API with game, chat, and authentication features",
        },
        tags: [
          { name: "auth", description: "Authentication endpoints" },
          { name: "users", description: "User management endpoints" },
          { name: "chat", description: "Real-time chat endpoints" },
          { name: "status", description: "Status and health endpoints" },
        ],
      },
    })
  )
  .use(
    staticPlugin({
      assets: "uploads",
      prefix: "/uploads",
    })
  )
  .group("/api", (app) =>
    app
      .use(statusController)
      .use(authController)
      .use(usersController)
      .use(rankingsController)
      .use(gamificationController)
      .use(notificationsController)
      .use(moderationController)
      .use(chatController)
      .use(matchmakingController)
  )
  .listen(env.PORT);

// Register server with shutdown manager and initialize signal handlers
if (app.server) {
  shutdownManager.registerServer(app.server);
}
shutdownManager.initialize();

logger.info({
  module: "server",
  action: "started",
  message: `Server running at ${app.server?.hostname}:${app.server?.port}`,
  port: app.server?.port,
  nodeEnv: env.NODE_ENV,
  corsOrigins: ALLOWED_ORIGINS,
});

export type App = typeof app;
