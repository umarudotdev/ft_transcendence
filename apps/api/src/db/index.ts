import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logger } from "../common/logger";
import { shutdownManager } from "../common/shutdown";
import { env } from "../env";
import * as schema from "./schema";

const dbLogger = logger.child("database");

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

// Register database shutdown handler
shutdownManager.register(
  "database",
  async () => {
    dbLogger.info({
      action: "closing",
      message: "Closing database connections",
    });
    await client.end({ timeout: 5 });
    dbLogger.info({ action: "closed", message: "Database connections closed" });
  },
  5000
);
