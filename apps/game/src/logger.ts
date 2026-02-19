import { createLogger } from "@ft/logger";

import { LOG_LEVEL, LOG_PRETTY } from "./config";

export const logger = createLogger({
  level: LOG_LEVEL,
  pretty: LOG_PRETTY,
  serviceName: "game",
});
