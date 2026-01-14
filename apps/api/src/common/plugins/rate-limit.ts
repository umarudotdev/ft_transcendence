import { Elysia } from "elysia";

import type { RateLimitProblem } from "../errors/problem-details";

import { HttpStatus } from "../errors/error-types";
import { rateLimited } from "../errors/problem-details-helper";

const PROBLEM_JSON_CONTENT_TYPE = "application/problem+json";

interface RateLimitConfig {
  max: number; // Maximum requests
  window: number; // Time window in milliseconds
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class RateLimitError extends Error {
  public readonly problem: RateLimitProblem;

  constructor(retryAfter: number, instance?: string) {
    super(`Too many requests. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.problem = rateLimited(retryAfter, { instance });
  }
}

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
    .onError(({ code, error, set, request }) => {
      if (code === "RATE_LIMIT") {
        set.status = HttpStatus.TOO_MANY_REQUESTS;
        set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;
        set.headers["Retry-After"] = String(error.problem.retryAfter);
        return {
          ...error.problem,
          instance: error.problem.instance ?? new URL(request.url).pathname,
        };
      }
    })
    .derive({ as: "scoped" }, (ctx) => {
      const forwardedFor = ctx.request.headers.get("x-forwarded-for");
      const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

      const url = new URL(ctx.request.url);
      const key = `${ip}:${url.pathname}`;
      const now = Date.now();

      let record = requestCounts.get(key);

      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + config.window };
        requestCounts.set(key, record);
      }

      record.count++;

      const remaining = Math.max(0, config.max - record.count);
      const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

      ctx.set.headers["X-RateLimit-Limit"] = String(config.max);
      ctx.set.headers["X-RateLimit-Remaining"] = String(remaining);
      ctx.set.headers["X-RateLimit-Reset"] = String(resetSeconds);

      if (record.count > config.max) {
        throw new RateLimitError(resetSeconds, url.pathname);
      }

      return {};
    });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60_000);
