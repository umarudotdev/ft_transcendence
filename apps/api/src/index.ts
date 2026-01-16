import cors from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { errorHandler } from "./common/plugins/error-handler";
import { env } from "./env";
import { authController } from "./modules/auth/auth.controller";
import { chatController } from "./modules/chat/chat.controller";
import { gamificationController } from "./modules/gamification/gamification.controller";
import { moderationController } from "./modules/moderation/moderation.controller";
import { notificationsController } from "./modules/notifications/notifications.controller";
import { rankingsController } from "./modules/rankings/rankings.controller";
import { statusController } from "./modules/status/status.controller";
import { usersController } from "./modules/users/users.controller";

const ALLOWED_ORIGINS = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const app = new Elysia()
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
  )
  .listen(env.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
