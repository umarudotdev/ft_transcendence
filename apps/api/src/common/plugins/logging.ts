import { Elysia } from "elysia";

import { logger } from "../logger";
import {
  type RequestContext,
  createRequestContext,
  runWithRequestContext,
  updateRequestContext,
} from "../logger/request-context";

/**
 * Elysia plugin for structured request logging.
 * Creates request context, tracks timing, and logs wide events on response.
 */
export const loggingPlugin = new Elysia({ name: "logging" })
  .derive(({ request }) => {
    // Create a new request context for this request
    const url = new URL(request.url);
    const ctx = createRequestContext({
      method: request.method,
      path: url.pathname,
    });

    return { requestContext: ctx };
  })
  .onBeforeHandle(({ requestContext }) => {
    // Run the handler within the request context
    // This is a bit tricky with Elysia - we set up the context in derive
    // and access it here for any middleware that needs it
    return runWithRequestContext(requestContext, () => undefined);
  })
  .onAfterResponse(({ request, requestContext, set }) => {
    // Log the completed request
    if (!requestContext) return;

    runWithRequestContext(requestContext as RequestContext, () => {
      const url = new URL(request.url);

      // Skip logging for health check endpoints to reduce noise
      if (
        url.pathname === "/api/status/live" ||
        url.pathname === "/api/status/ready"
      ) {
        return;
      }

      logger.request({
        statusCode: typeof set.status === "number" ? set.status : 200,
      });
    });
  })
  .onError(({ request, error, requestContext }) => {
    // Log errors with full context
    if (!requestContext) return;

    runWithRequestContext(requestContext as RequestContext, () => {
      const url = new URL(request.url);
      const errorObj = error instanceof Error ? error : null;

      logger.error({
        module: "http",
        action: "error",
        error: errorObj?.message ?? String(error),
        errorType: errorObj?.name ?? "UnknownError",
        errorStack: errorObj?.stack,
        path: url.pathname,
      });
    });
  });

/**
 * Helper to attach user context to the current request.
 * Call this after authentication to include user info in logs.
 */
export function attachUserContext(userId: number, sessionId?: string): void {
  updateRequestContext({ userId, sessionId });
}
