import type { Logger as DrizzleLogger } from "drizzle-orm/logger";

import { logger } from "../common/logger";

const dbLogger = logger.child().withContext({ module: "database" });

export class StructuredDrizzleLogger implements DrizzleLogger {
  logQuery(query: string, params: unknown[]): void {
    dbLogger
      .withMetadata({ query, params: params.length > 0 ? params : undefined })
      .debug("Query");
  }
}
