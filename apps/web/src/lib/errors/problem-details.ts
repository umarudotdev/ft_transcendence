/**
 * RFC 9457 Problem Details type definitions for the frontend.
 * These mirror the backend error response format.
 */
export interface ProblemDetails {
  /** URI reference identifying the problem type */
  type: string;
  /** HTTP status code */
  status: number;
  /** Short, human-readable summary */
  title: string;
  /** Human-readable explanation specific to this occurrence */
  detail: string;
  /** URI reference identifying this specific occurrence */
  instance?: string;
}

/**
 * Extended Problem Details for validation errors.
 */
export interface ValidationProblem extends ProblemDetails {
  /** Array of field-level validation errors */
  errors: Array<{ field: string; message: string }>;
}

/**
 * Extended Problem Details for rate limit errors.
 */
export interface RateLimitProblem extends ProblemDetails {
  /** Seconds until the client can retry */
  retryAfter: number;
}

/**
 * Extended Problem Details for account lock errors.
 */
export interface LockedProblem extends ProblemDetails {
  /** ISO timestamp when the account will be unlocked */
  unlockAt: string;
}

/**
 * Error type URIs matching the backend.
 */
export const ErrorTypes = {
  VALIDATION: "https://api.ft.local/errors/validation",
  UNAUTHORIZED: "https://api.ft.local/errors/unauthorized",
  FORBIDDEN: "https://api.ft.local/errors/forbidden",
  NOT_FOUND: "https://api.ft.local/errors/not-found",
  CONFLICT: "https://api.ft.local/errors/conflict",
  RATE_LIMITED: "https://api.ft.local/errors/rate-limited",
  INTERNAL: "https://api.ft.local/errors/internal-error",
  SERVICE_UNAVAILABLE: "https://api.ft.local/errors/service-unavailable",
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

/**
 * Type guard to check if a value is a Problem Details response.
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "status" in value &&
    "title" in value &&
    "detail" in value &&
    typeof (value as ProblemDetails).type === "string" &&
    typeof (value as ProblemDetails).status === "number" &&
    typeof (value as ProblemDetails).title === "string" &&
    typeof (value as ProblemDetails).detail === "string"
  );
}

/**
 * Type guard for validation errors.
 */
export function isValidationProblem(
  value: unknown
): value is ValidationProblem {
  return (
    isProblemDetails(value) &&
    "errors" in value &&
    Array.isArray((value as ValidationProblem).errors)
  );
}

/**
 * Type guard for rate limit errors.
 */
export function isRateLimitProblem(value: unknown): value is RateLimitProblem {
  return (
    isProblemDetails(value) &&
    "retryAfter" in value &&
    typeof (value as RateLimitProblem).retryAfter === "number"
  );
}

/**
 * Type guard for account lock errors.
 */
export function isLockedProblem(value: unknown): value is LockedProblem {
  return (
    isProblemDetails(value) &&
    "unlockAt" in value &&
    typeof (value as LockedProblem).unlockAt === "string"
  );
}
