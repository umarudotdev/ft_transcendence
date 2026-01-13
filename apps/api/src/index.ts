import cors from "@elysiajs/cors";
import { Elysia } from "elysia";

import { authController } from "./modules/auth/auth.controller";
import { statusController } from "./modules/status/status.controller";

const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true, // Required for cookies
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
