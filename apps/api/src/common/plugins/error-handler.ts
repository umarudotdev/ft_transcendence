import { Elysia } from "elysia";

import { HttpStatus } from "../errors/error-types";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "../errors/problem-details-helper";

const PROBLEM_JSON_CONTENT_TYPE = "application/problem+json";

/**
 * Global error handler plugin for Elysia.
 * Catches and formats all errors as RFC 9457 Problem Details responses.
 *
 * Handles:
 * - VALIDATION: TypeBox validation failures → 422
 * - NOT_FOUND: Route not found → 404
 * - PARSE: Invalid JSON body → 400
 * - INTERNAL_SERVER_ERROR/UNKNOWN: Uncaught exceptions → 500
 */
export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set, request }) => {
    const instance = new URL(request.url).pathname;

    if (code === "VALIDATION") {
      set.status = HttpStatus.UNPROCESSABLE_ENTITY;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;

      const fieldErrors = parseValidationError(error);
      return validationError(
        "One or more fields failed validation",
        fieldErrors,
        {
          instance,
        }
      );
    }

    if (code === "NOT_FOUND") {
      set.status = HttpStatus.NOT_FOUND;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;

      return notFound("The requested resource was not found", { instance });
    }

    if (code === "PARSE") {
      set.status = HttpStatus.BAD_REQUEST;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;

      return badRequest("Invalid request body format", { instance });
    }

    if (code === "INTERNAL_SERVER_ERROR" || code === "UNKNOWN") {
      console.error("[ErrorHandler] Unhandled error:", error);
      set.status = HttpStatus.INTERNAL_SERVER_ERROR;
      set.headers["Content-Type"] = PROBLEM_JSON_CONTENT_TYPE;

      return internalError(undefined, { instance });
    }
  }
);

/**
 * Parses Elysia validation errors into field-level error objects.
 * Handles TypeBox validation error format.
 */
function parseValidationError(
  error: Error
): Array<{ field: string; message: string }> {
  try {
    const message = error.message;

    // Elysia validation errors typically include the property path
    // Format varies by Elysia version, handle common patterns
    const propertyMatch = message.match(/property '([^']+)'/i);
    const expectedMatch = message.match(/Expected ([^,]+)/i);
    const atMatch = message.match(/at ([^:]+)/i);

    if (propertyMatch?.[1]) {
      return [
        {
          field: propertyMatch[1],
          message: expectedMatch?.[1]
            ? `Expected ${expectedMatch[1]}`
            : message,
        },
      ];
    }

    if (atMatch?.[1]) {
      return [
        {
          field: atMatch[1],
          message: expectedMatch?.[1]
            ? `Expected ${expectedMatch[1]}`
            : message,
        },
      ];
    }

    // Fallback: try to extract field name from common patterns
    const fieldMatch = message.match(
      /["']?(\w+)["']?\s+(?:is|must|should|expected)/i
    );
    if (fieldMatch?.[1]) {
      return [{ field: fieldMatch[1], message }];
    }

    return [{ field: "unknown", message }];
  } catch {
    return [{ field: "unknown", message: error.message }];
  }
}
