import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request context stored in AsyncLocalStorage for request correlation.
 * Enables automatic context propagation across async boundaries.
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: number;
  sessionId?: string;
  method?: string;
  path?: string;
  dbQueryCount: number;
  dbQueryTimeMs: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a unique request ID using Bun's native random UUID
 */
function generateRequestId(): string {
  // Use first 12 chars of UUID for a shorter but still unique ID
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Create a new request context with default values
 */
export function createRequestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    requestId: generateRequestId(),
    startTime: Date.now(),
    dbQueryCount: 0,
    dbQueryTimeMs: 0,
    ...overrides,
  };
}

/**
 * Get the current request context or undefined if not in a request
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Run a function within a request context
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Update the current request context with new values.
 * Only works if called within a request context.
 */
export function updateRequestContext(
  updates: Partial<RequestContext>
): boolean {
  const ctx = getRequestContext();
  if (!ctx) return false;

  Object.assign(ctx, updates);
  return true;
}

/**
 * Record a database query in the current request context
 */
export function recordDbQuery(durationMs: number): void {
  const ctx = getRequestContext();
  if (ctx) {
    ctx.dbQueryCount += 1;
    ctx.dbQueryTimeMs += durationMs;
  }
}
