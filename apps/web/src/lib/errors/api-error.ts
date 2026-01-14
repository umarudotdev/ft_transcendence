import {
  ErrorTypes,
  isProblemDetails,
  isRateLimitProblem,
  isValidationProblem,
  type ProblemDetails,
} from "./problem-details";

/**
 * Custom error class for API errors.
 * Wraps RFC 9457 Problem Details responses with convenient accessors.
 */
export class ApiError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = "ApiError";
    this.problem = problem;
  }

  /** HTTP status code from the error response */
  get status(): number {
    return this.problem.status;
  }

  /** Error type URI */
  get type(): string {
    return this.problem.type;
  }

  /** Human-readable title */
  get title(): string {
    return this.problem.title;
  }

  /** Human-readable detail message */
  get detail(): string {
    return this.problem.detail;
  }

  /** Request instance path */
  get instance(): string | undefined {
    return this.problem.instance;
  }

  /** Check if this is a validation error (422) */
  get isValidationError(): boolean {
    return this.problem.type === ErrorTypes.VALIDATION;
  }

  /** Check if this is an unauthorized error (401) */
  get isUnauthorized(): boolean {
    return this.problem.type === ErrorTypes.UNAUTHORIZED;
  }

  /** Check if this is a forbidden error (403) */
  get isForbidden(): boolean {
    return this.problem.type === ErrorTypes.FORBIDDEN;
  }

  /** Check if this is a not found error (404) */
  get isNotFound(): boolean {
    return this.problem.type === ErrorTypes.NOT_FOUND;
  }

  /** Check if this is a conflict error (409) */
  get isConflict(): boolean {
    return this.problem.type === ErrorTypes.CONFLICT;
  }

  /** Check if this is a rate limit error (429) */
  get isRateLimited(): boolean {
    return this.problem.type === ErrorTypes.RATE_LIMITED;
  }

  /**
   * Get field-level validation errors if this is a validation error.
   * Returns empty array for non-validation errors.
   */
  getValidationErrors(): Array<{ field: string; message: string }> {
    if (isValidationProblem(this.problem)) {
      return this.problem.errors;
    }
    return [];
  }

  /**
   * Get error message for a specific field if this is a validation error.
   */
  getFieldError(field: string): string | undefined {
    const errors = this.getValidationErrors();
    return errors.find((e) => e.field === field)?.message;
  }

  /**
   * Get retry-after seconds if this is a rate limit error.
   * Returns null for non-rate-limit errors.
   */
  getRetryAfter(): number | null {
    if (isRateLimitProblem(this.problem)) {
      return this.problem.retryAfter;
    }
    return null;
  }
}

/**
 * Creates an ApiError from an Eden Treaty error response.
 * Handles both Problem Details responses and legacy error formats.
 *
 * @param errorValue - The error value from Eden Treaty response
 * @returns ApiError instance
 */
export function createApiError(errorValue: unknown): ApiError {
  // Handle Problem Details response
  if (isProblemDetails(errorValue)) {
    return new ApiError(errorValue);
  }

  // Handle legacy error format with message property
  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "message" in errorValue
  ) {
    const legacyError = errorValue as { message?: string; status?: number };
    return new ApiError({
      type: "about:blank",
      status: legacyError.status ?? 500,
      title: "Error",
      detail: String(legacyError.message ?? "An unexpected error occurred"),
    });
  }

  // Handle string error
  if (typeof errorValue === "string") {
    return new ApiError({
      type: "about:blank",
      status: 500,
      title: "Error",
      detail: errorValue,
    });
  }

  // Fallback for unknown error format
  return new ApiError({
    type: "about:blank",
    status: 500,
    title: "Error",
    detail: "An unexpected error occurred",
  });
}

/**
 * Extracts a user-friendly error message from an API error.
 * Prefers the detail field from Problem Details, falls back to message property.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    if (isProblemDetails(error)) {
      return error.detail;
    }
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("detail" in error && typeof error.detail === "string") {
      return error.detail;
    }
  }

  return "An unexpected error occurred";
}
