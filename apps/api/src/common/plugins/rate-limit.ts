import { Elysia } from "elysia";

interface RateLimitConfig {
  max: number; // Maximum requests
  window: number; // Time window in milliseconds
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Custom error class for rate limit errors
class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Too many requests. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
  }
}

// Simple in-memory rate limiter
// In production, use Redis for distributed environments
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Creates a rate limiting middleware plugin for Elysia.
 *
 * @param config - Rate limit configuration
 * @param config.max - Maximum number of requests allowed in the window
 * @param config.window - Time window in milliseconds
 */
export function rateLimit(config: RateLimitConfig) {
  return new Elysia({ name: "rate-limit" })
    .error({ RATE_LIMIT: RateLimitError })
    .onError(({ code, error, set }) => {
      if (code === "RATE_LIMIT") {
        set.status = 429;
        set.headers["Retry-After"] = String(error.retryAfter);
        return {
          message: "Too many requests",
          retryAfter: error.retryAfter,
        };
      }
    })
    .derive({ as: "scoped" }, (ctx) => {
      // Get client IP (handle proxies)
      const forwardedFor = ctx.request.headers.get("x-forwarded-for");
      const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

      // Create a key based on IP and URL path
      const url = new URL(ctx.request.url);
      const key = `${ip}:${url.pathname}`;
      const now = Date.now();

      let record = requestCounts.get(key);

      // Reset if window expired
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + config.window };
        requestCounts.set(key, record);
      }

      record.count++;

      // Add rate limit headers
      const remaining = Math.max(0, config.max - record.count);
      const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

      ctx.set.headers["X-RateLimit-Limit"] = String(config.max);
      ctx.set.headers["X-RateLimit-Remaining"] = String(remaining);
      ctx.set.headers["X-RateLimit-Reset"] = String(resetSeconds);

      // Check if over limit
      if (record.count > config.max) {
        throw new RateLimitError(resetSeconds);
      }

      return {};
    });
}

// Cleanup old entries periodically (every minute)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60_000);
