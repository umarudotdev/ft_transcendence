/**
 * Error type URIs following RFC 9457 Problem Details specification.
 * These URIs identify the problem category and should be resolvable
 * to documentation describing the error.
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
 * HTTP status code constants for consistent usage across the API.
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  FOUND: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Human-readable titles for each error type.
 * Used as the default title in Problem Details responses.
 */
export const ErrorTitles: Record<ErrorType, string> = {
  [ErrorTypes.VALIDATION]: "Validation Failed",
  [ErrorTypes.UNAUTHORIZED]: "Authentication Required",
  [ErrorTypes.FORBIDDEN]: "Access Denied",
  [ErrorTypes.NOT_FOUND]: "Resource Not Found",
  [ErrorTypes.CONFLICT]: "Resource Conflict",
  [ErrorTypes.RATE_LIMITED]: "Too Many Requests",
  [ErrorTypes.INTERNAL]: "Internal Server Error",
  [ErrorTypes.SERVICE_UNAVAILABLE]: "Service Unavailable",
};

/**
 * Default titles for HTTP status codes when no error type is specified.
 */
export const StatusTitles: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  423: "Locked",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};
