import cors from "@elysiajs/cors";
import { Elysia } from "elysia";

import { statusController } from "./modules/status/status.controller";

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({
    status: "ok",
  }))
  .group("/api", (app) => app.use(statusController))
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
