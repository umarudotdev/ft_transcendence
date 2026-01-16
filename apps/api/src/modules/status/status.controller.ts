import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { getShuttingDown } from "../../common/shutdown/state";
import { db } from "../../db";

/**
 * Check database connectivity with a simple query
 */
async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const statusController = new Elysia({
  prefix: "/status",
})
  /**
   * Full health check with database connectivity.
   * Returns detailed status information.
   */
  .get("/", async () => {
    const dbHealth = await checkDatabaseHealth();

    return {
      status: dbHealth.healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealth.healthy ? "healthy" : "unhealthy",
          latencyMs: dbHealth.latencyMs,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
      },
    };
  })

  /**
   * Readiness probe - can this instance serve traffic?
   * Returns 503 if shutting down or database is unhealthy.
   */
  .get("/ready", async ({ set }) => {
    if (getShuttingDown()) {
      set.status = 503;
      return {
        ready: false,
        reason: "shutting_down",
      };
    }

    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.healthy) {
      set.status = 503;
      return {
        ready: false,
        reason: "database_unhealthy",
        error: dbHealth.error,
      };
    }

    return {
      ready: true,
    };
  })

  /**
   * Liveness probe - is the process alive and responding?
   * Simple check that doesn't verify dependencies.
   */
  .get("/live", () => ({
    alive: true,
  }));
