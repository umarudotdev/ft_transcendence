import { t, type Static } from "elysia";

/**
 * RFC 9457 Problem Details base schema.
 * Provides a standard format for HTTP API error responses.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9457
 */
export const ProblemDetailsSchema = t.Object({
  /** URI reference identifying the problem type */
  type: t.String({ default: "about:blank" }),
  /** HTTP status code (mirrored from response) */
  status: t.Integer(),
  /** Short, human-readable summary of the problem */
  title: t.String(),
  /** Human-readable explanation specific to this occurrence */
  detail: t.String(),
  /** URI reference identifying the specific occurrence */
  instance: t.Optional(t.String()),
});

export type ProblemDetails = Static<typeof ProblemDetailsSchema>;

/**
 * Field-level validation error structure.
 */
export const FieldErrorSchema = t.Object({
  /** The field name that failed validation */
  field: t.String(),
  /** Human-readable error message for this field */
  message: t.String(),
});

export type FieldError = Static<typeof FieldErrorSchema>;

/**
 * Extended Problem Details for validation errors.
 * Includes an array of field-level errors.
 */
export const ValidationProblemSchema = t.Composite([
  ProblemDetailsSchema,
  t.Object({
    /** Array of field-level validation errors */
    errors: t.Array(FieldErrorSchema),
  }),
]);

export type ValidationProblem = Static<typeof ValidationProblemSchema>;

/**
 * Extended Problem Details for rate limit errors.
 * Includes retry-after information.
 */
export const RateLimitProblemSchema = t.Composite([
  ProblemDetailsSchema,
  t.Object({
    /** Seconds until the client can retry */
    retryAfter: t.Integer(),
  }),
]);

export type RateLimitProblem = Static<typeof RateLimitProblemSchema>;

/**
 * Extended Problem Details for account lock errors.
 * Includes unlock time information.
 */
export const LockedProblemSchema = t.Composite([
  ProblemDetailsSchema,
  t.Object({
    /** ISO timestamp when the account will be unlocked */
    unlockAt: t.String(),
  }),
]);

export type LockedProblem = Static<typeof LockedProblemSchema>;
