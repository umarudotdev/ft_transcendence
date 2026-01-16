import { env, type LogLevel } from "../../env";
import { getRequestContext } from "./request-context";

/**
 * Wide event structure for structured logging.
 * Contains all relevant context for observability.
 */
export interface WideEvent {
  // Core fields
  timestamp: string;
  level: LogLevel;
  message?: string;
  module?: string;
  action?: string;

  // Request context
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;

  // User context
  userId?: number;
  sessionId?: string;

  // Database metrics
  dbQueryCount?: number;
  dbQueryTimeMs?: number;

  // Error context
  error?: string;
  errorStack?: string;
  errorType?: string;

  // WebSocket context
  wsEvent?: "open" | "message" | "close" | "error";
  channelId?: number;

  // Additional fields
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = LOG_LEVELS[env.LOG_LEVEL];

/**
 * Check if a log level should be emitted based on configuration
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= configuredLevel;
}

/**
 * Check if an event should be sampled (for tail sampling).
 * Always logs errors, slow requests, and samples based on LOG_SAMPLE_RATE.
 */
function shouldSample(event: WideEvent): boolean {
  // Always log errors
  if (event.level === "error" || event.level === "warn") {
    return true;
  }

  // Always log slow requests (> 1s)
  if (event.durationMs !== undefined && event.durationMs > 1000) {
    return true;
  }

  // Always log non-2xx responses
  if (
    event.statusCode !== undefined &&
    (event.statusCode < 200 || event.statusCode >= 300)
  ) {
    return true;
  }

  // Sample based on configured rate
  return Math.random() < env.LOG_SAMPLE_RATE;
}

/**
 * Format an event for pretty printing (development)
 */
function formatPretty(event: WideEvent): string {
  const levelColors: Record<LogLevel, string> = {
    debug: "\x1b[90m", // gray
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
  };

  const reset = "\x1b[0m";
  const dim = "\x1b[2m";
  const color = levelColors[event.level];

  const parts: string[] = [];

  // Timestamp and level
  const time = new Date(event.timestamp).toLocaleTimeString();
  parts.push(
    `${dim}${time}${reset} ${color}${event.level.toUpperCase().padEnd(5)}${reset}`
  );

  // Request info
  if (event.method && event.path) {
    const statusColor =
      event.statusCode && event.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
    parts.push(
      `${event.method} ${event.path} ${statusColor}${event.statusCode ?? ""}${reset}`
    );
  }

  // Module and action
  if (event.module) {
    parts.push(`[${event.module}${event.action ? `:${event.action}` : ""}]`);
  }

  // Message
  if (event.message) {
    parts.push(event.message);
  }

  // Duration
  if (event.durationMs !== undefined) {
    const durationColor = event.durationMs > 1000 ? "\x1b[33m" : dim;
    parts.push(`${durationColor}${event.durationMs}ms${reset}`);
  }

  // DB metrics
  if (event.dbQueryCount) {
    parts.push(
      `${dim}db:${event.dbQueryCount}q/${event.dbQueryTimeMs}ms${reset}`
    );
  }

  // User info
  if (event.userId) {
    parts.push(`${dim}user:${event.userId}${reset}`);
  }

  // Request ID
  if (event.requestId) {
    parts.push(`${dim}rid:${event.requestId}${reset}`);
  }

  // Error
  if (event.error) {
    parts.push(`\n  ${color}Error: ${event.error}${reset}`);
  }
  if (event.errorStack) {
    parts.push(`\n  ${dim}${event.errorStack}${reset}`);
  }

  return parts.join(" ");
}

/**
 * Format an event as JSON
 */
function formatJson(event: WideEvent): string {
  // Filter out undefined values for cleaner JSON
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return JSON.stringify(cleaned);
}

/**
 * Output a log event to stdout/stderr
 */
function emit(event: WideEvent): void {
  const output =
    env.LOG_FORMAT === "pretty" ? formatPretty(event) : formatJson(event);

  if (event.level === "error") {
    process.stderr.write(`${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
}

/**
 * Create a wide event with automatic context from AsyncLocalStorage
 */
function createEvent(
  level: LogLevel,
  messageOrFields: string | Partial<WideEvent>,
  extraFields?: Partial<WideEvent>
): WideEvent {
  const ctx = getRequestContext();

  const baseEvent: WideEvent = {
    timestamp: new Date().toISOString(),
    level,
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    sessionId: ctx?.sessionId,
    method: ctx?.method,
    path: ctx?.path,
  };

  if (typeof messageOrFields === "string") {
    return { ...baseEvent, message: messageOrFields, ...extraFields };
  }

  return { ...baseEvent, ...messageOrFields };
}

/**
 * Structured logger with wide events support.
 * Automatically includes request context when available.
 */
export const logger = {
  debug(
    messageOrFields: string | Partial<WideEvent>,
    fields?: Partial<WideEvent>
  ): void {
    if (!shouldLog("debug")) return;
    const event = createEvent("debug", messageOrFields, fields);
    if (shouldSample(event)) emit(event);
  },

  info(
    messageOrFields: string | Partial<WideEvent>,
    fields?: Partial<WideEvent>
  ): void {
    if (!shouldLog("info")) return;
    const event = createEvent("info", messageOrFields, fields);
    if (shouldSample(event)) emit(event);
  },

  warn(
    messageOrFields: string | Partial<WideEvent>,
    fields?: Partial<WideEvent>
  ): void {
    if (!shouldLog("warn")) return;
    const event = createEvent("warn", messageOrFields, fields);
    emit(event); // Always emit warnings
  },

  error(
    messageOrFields: string | Partial<WideEvent>,
    fields?: Partial<WideEvent> | Error
  ): void {
    if (!shouldLog("error")) return;

    let event = createEvent("error", messageOrFields);

    // Handle Error objects
    if (fields instanceof Error) {
      event = {
        ...event,
        error: fields.message,
        errorType: fields.name,
        errorStack: fields.stack,
      };
    } else if (fields) {
      event = { ...event, ...fields };
    }

    emit(event); // Always emit errors
  },

  /**
   * Log a request completion event (wide event with all metrics)
   */
  request(fields: Partial<WideEvent>): void {
    if (!shouldLog("info")) return;
    const ctx = getRequestContext();

    const event: WideEvent = {
      timestamp: new Date().toISOString(),
      level: "info",
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      sessionId: ctx?.sessionId,
      method: ctx?.method,
      path: ctx?.path,
      durationMs: ctx ? Date.now() - ctx.startTime : undefined,
      dbQueryCount: ctx?.dbQueryCount,
      dbQueryTimeMs: ctx?.dbQueryTimeMs,
      ...fields,
    };

    if (shouldSample(event)) emit(event);
  },

  /**
   * Log a WebSocket event
   */
  ws(
    wsEvent: "open" | "message" | "close" | "error",
    fields: Partial<WideEvent> = {}
  ): void {
    if (!shouldLog("info")) return;
    const event = createEvent("info", {
      wsEvent,
      module: "websocket",
      ...fields,
    });
    if (shouldSample(event)) emit(event);
  },

  /**
   * Create a child logger with fixed module context
   */
  child(module: string) {
    return {
      debug: (msg: string | Partial<WideEvent>, fields?: Partial<WideEvent>) =>
        logger.debug(
          typeof msg === "string"
            ? { message: msg, module, ...fields }
            : { module, ...msg }
        ),
      info: (msg: string | Partial<WideEvent>, fields?: Partial<WideEvent>) =>
        logger.info(
          typeof msg === "string"
            ? { message: msg, module, ...fields }
            : { module, ...msg }
        ),
      warn: (msg: string | Partial<WideEvent>, fields?: Partial<WideEvent>) =>
        logger.warn(
          typeof msg === "string"
            ? { message: msg, module, ...fields }
            : { module, ...msg }
        ),
      error: (
        msg: string | Partial<WideEvent>,
        fields?: Partial<WideEvent> | Error
      ) =>
        logger.error(
          typeof msg === "string"
            ? { message: msg, module }
            : { module, ...msg },
          fields
        ),
    };
  },
};

export {
  getRequestContext,
  updateRequestContext,
  recordDbQuery,
} from "./request-context";
