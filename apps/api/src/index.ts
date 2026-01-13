import cors from "@elysiajs/cors";
import { Elysia } from "elysia";

import { authController } from "./modules/auth/auth.controller";
import { statusController } from "./modules/status/status.controller";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL ?? "http://localhost:5173",
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
  .group("/api", (app) => app.use(statusController).use(authController))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
