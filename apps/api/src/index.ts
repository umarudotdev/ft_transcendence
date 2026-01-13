import cors from "@elysiajs/cors";
import { Elysia } from "elysia";

import { statusController } from "./modules/status/status.controller";

const app = new Elysia({
  prefix: "/api",
})
  .use(cors())
  .use(statusController)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
