import { createLogger } from "@ft/logger";

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  pretty: process.env.LOG_FORMAT === "pretty",
  serviceName: "web",
});
