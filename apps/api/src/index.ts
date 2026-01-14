import cors from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { env } from "./env";
import { authController } from "./modules/auth/auth.controller";
import { statusController } from "./modules/status/status.controller";
import { usersController } from "./modules/users/users.controller";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const app = new Elysia()
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
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .use(
    staticPlugin({
      assets: "uploads",
      prefix: "/uploads",
    })
  )
  .group("/api", (app) =>
    app.use(statusController).use(authController).use(usersController)
  )
  .listen(env.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
