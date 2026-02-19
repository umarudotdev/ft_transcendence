import { createLogger } from "@ft/logger";

import { env } from "../../env";

export const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.LOG_FORMAT === "pretty",
  serviceName: "api",
});
