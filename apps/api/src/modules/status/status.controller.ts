import { Elysia } from "elysia";

export const statusController = new Elysia({
  prefix: "/status",
}).get("/", () => ({
  status: "healthy",
  timestamp: new Date().toISOString(),
}));
