import type {
  FieldError,
  LockedProblem,
  ProblemDetails,
  RateLimitProblem,
  ValidationProblem,
} from "./problem-details";

import {
  ErrorTitles,
  ErrorTypes,
  HttpStatus,
  StatusTitles,
} from "./error-types";

export interface ProblemOptions {
  /** Error type URI (defaults to "about:blank") */
  type?: string;
  /** Custom title (defaults to error type title or status title) */
  title?: string;
  /** Request path for the instance field */
  instance?: string;
  /** Additional extension fields */
  extensions?: Record<string, unknown>;
}

/**
 * Creates an RFC 9457 Problem Details response object.
 *
 * @param status - HTTP status code
 * @param detail - Human-readable explanation of the error
 * @param options - Additional options for customization
 * @returns Problem Details object ready for JSON response
 */
export function problemDetails(
  status: number,
  detail: string,
  options: ProblemOptions = {}
): ProblemDetails & Record<string, unknown> {
  const type = options.type ?? "about:blank";
  const title =
    options.title ??
    (type !== "about:blank"
      ? ErrorTitles[type as keyof typeof ErrorTitles]
      : undefined) ??
    StatusTitles[status] ??
    "Error";

  return {
    type,
    status,
    title,
    detail,
    ...(options.instance && { instance: options.instance }),
    ...options.extensions,
  };
}

/**
 * Creates an unauthorized (401) Problem Details response.
 */
export function unauthorized(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.UNAUTHORIZED, detail, {
    ...options,
    type: ErrorTypes.UNAUTHORIZED,
  });
}

/**
 * Creates a forbidden (403) Problem Details response.
 */
export function forbidden(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.FORBIDDEN, detail, {
    ...options,
    type: ErrorTypes.FORBIDDEN,
  });
}

/**
 * Creates a not found (404) Problem Details response.
 */
export function notFound(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.NOT_FOUND, detail, {
    ...options,
    type: ErrorTypes.NOT_FOUND,
  });
}

/**
 * Creates a conflict (409) Problem Details response.
 */
export function conflict(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.CONFLICT, detail, {
    ...options,
    type: ErrorTypes.CONFLICT,
  });
}

/**
 * Creates a validation error (422) Problem Details response with field-level errors.
 */
export function validationError(
  detail: string,
  errors: FieldError[],
  options?: Omit<ProblemOptions, "type">
): ValidationProblem {
  return problemDetails(HttpStatus.UNPROCESSABLE_ENTITY, detail, {
    ...options,
    type: ErrorTypes.VALIDATION,
    extensions: { errors },
  }) as ValidationProblem;
}

/**
 * Creates a rate limited (429) Problem Details response.
 */
export function rateLimited(
  retryAfter: number,
  options?: Omit<ProblemOptions, "type">
): RateLimitProblem {
  return problemDetails(
    HttpStatus.TOO_MANY_REQUESTS,
    `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
    {
      ...options,
      type: ErrorTypes.RATE_LIMITED,
      extensions: { retryAfter },
    }
  ) as RateLimitProblem;
}

/**
 * Creates an account locked (423) Problem Details response.
 */
export function locked(
  unlockAt: Date,
  options?: Omit<ProblemOptions, "type">
): LockedProblem {
  return problemDetails(
    HttpStatus.LOCKED,
    `Account locked until ${unlockAt.toISOString()}`,
    {
      ...options,
      type: ErrorTypes.FORBIDDEN,
      extensions: { unlockAt: unlockAt.toISOString() },
    }
  ) as LockedProblem;
}

/**
 * Creates an internal server error (500) Problem Details response.
 */
export function internalError(
  detail = "An unexpected error occurred",
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.INTERNAL_SERVER_ERROR, detail, {
    ...options,
    type: ErrorTypes.INTERNAL,
  });
}

/**
 * Creates a service unavailable (503) Problem Details response.
 */
export function serviceUnavailable(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.SERVICE_UNAVAILABLE, detail, {
    ...options,
    type: ErrorTypes.SERVICE_UNAVAILABLE,
  });
}

/**
 * Creates a bad request (400) Problem Details response.
 */
export function badRequest(
  detail: string,
  options?: Omit<ProblemOptions, "type">
): ProblemDetails {
  return problemDetails(HttpStatus.BAD_REQUEST, detail, options);
}
