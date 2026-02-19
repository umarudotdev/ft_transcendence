import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logger } from "../common/logger";
import { shutdownManager } from "../common/shutdown";
import { env } from "../env";
import { StructuredDrizzleLogger } from "./drizzle-logger";
import * as schema from "./schema";

const dbLogger = logger.child().withContext({ module: "database" });

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, {
  schema,
  logger: env.LOG_LEVEL === "debug" ? new StructuredDrizzleLogger() : false,
});

// Register database shutdown handler
shutdownManager.register(
  "database",
  async () => {
    dbLogger
      .withMetadata({ action: "closing" })
      .info("Closing database connections");
    await client.end({ timeout: 5 });
    dbLogger
      .withMetadata({ action: "closed" })
      .info("Database connections closed");
  },
  5000
);
