import { Elysia } from "elysia";

import { logger } from "../logger";

export const loggingPlugin = new Elysia({ name: "logging" })
  .derive(({ request }) => {
    const url = new URL(request.url);
    const log = logger.child().withContext({
      requestId: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
      method: request.method,
      path: url.pathname,
    });
    return { log, requestStartTime: performance.now() };
  })
  .onAfterResponse(({ log, requestStartTime, request, set }) => {
    if (!log) return;
    const url = new URL(request.url);
    if (
      url.pathname === "/api/status/live" ||
      url.pathname === "/api/status/ready"
    ) {
      return;
    }
    const durationMs = Math.round(performance.now() - requestStartTime);
    const statusCode = typeof set.status === "number" ? set.status : 200;
    log.withMetadata({ statusCode, durationMs }).info("Request completed");
  })
  .onError(({ log, error }) => {
    const err = error instanceof Error ? error : new Error(String(error));
    if (!log) {
      logger.withError(err).error("Request error (no context)");
      return;
    }
    log.withError(err).error("Request error");
  });
