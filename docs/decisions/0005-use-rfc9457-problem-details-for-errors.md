# Use RFC 9457 Problem Details for API Errors

## Status

Accepted

## Context and Problem Statement

The ft_transcendence API needs a consistent error response format. Currently, error handling is ad-hoc, making it difficult for the frontend to:

- Distinguish between error types programmatically
- Display appropriate localized error messages
- Handle specific errors differently (e.g., validation vs. authentication)

How should we structure API error responses to provide consistent, machine-readable error information?

## Decision Drivers

- Frontend needs to programmatically handle different error types
- Eden Treaty should provide typed error responses
- Error responses must be consistent across all endpoints
- Must support validation errors with field-level detail
- Should follow industry standards for interoperability

## Considered Options

- Ad-hoc error objects per endpoint
- Custom error envelope format
- RFC 9457 Problem Details

## Decision Outcome

Chosen option: "RFC 9457 Problem Details", because it provides a standardized, extensible format that is well-documented and supported by tooling across the industry.

### Consequences

#### Positive

- Consistency: All errors follow the same structure across the API
- Machine-readable: Frontend can switch on `type` URI for specific handling
- Extensible: Can add custom fields (e.g., `field` for validation errors)
- Typed: Can define TypeBox schemas for Eden Treaty type inference
- Standard: Well-documented RFC with broad industry adoption

#### Negative

- Overhead: Requires defining error type URIs for each error category
- Learning curve: Team must understand RFC 9457 semantics

### Confirmation

The decision will be confirmed by:

- All API error responses using `application/problem+json` content type
- Frontend successfully switching on error `type` for different handling
- Validation errors including field-level information via extensions

## Pros and Cons of the Options

### Ad-hoc Error Objects

- Good, because no upfront design required
- Bad, because inconsistent structure across endpoints
- Bad, because frontend must handle each endpoint's errors differently
- Bad, because no standard for Eden Treaty typing

### Custom Error Envelope Format

- Good, because can design for exact needs
- Good, because consistent across API
- Bad, because non-standard, requires documentation
- Bad, because no tooling support
- Bad, because reinventing the wheel

### RFC 9457 Problem Details

- Good, because industry standard with broad adoption
- Good, because well-documented semantics
- Good, because extensible via custom fields
- Good, because consistent structure enables typed responses
- Good, because future-proof (replaces RFC 7807)
- Bad, because requires defining error type URIs
- Bad, because slightly more verbose than minimal error objects

## More Information

### Response Format

```json
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.ft.local/errors/validation",
  "status": 422,
  "title": "Validation Failed",
  "detail": "One or more fields failed validation",
  "instance": "/api/users/register",
  "errors": [
    { "field": "username", "message": "Must be between 3 and 20 characters" },
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### Standard Fields

| Field      | Type   | Description                                 |
| ---------- | ------ | ------------------------------------------- |
| `type`     | URI    | Identifies the problem category             |
| `status`   | number | HTTP status code (mirrored from response)   |
| `title`    | string | Short, human-readable summary               |
| `detail`   | string | Explanation specific to this occurrence     |
| `instance` | URI    | Identifies this specific problem occurrence |

### Extension Fields

For validation errors, we extend with:

- `errors`: Array of `{ field, message }` objects for field-level details

For rate limiting:

- `retryAfter`: Seconds until the client can retry

### Error Type URIs

| Type URI                                   | Status | Usage                      |
| ------------------------------------------ | ------ | -------------------------- |
| `about:blank`                              | varies | Generic errors (use title) |
| `https://api.ft.local/errors/validation`   | 422    | Request validation failed  |
| `https://api.ft.local/errors/unauthorized` | 401    | Authentication required    |
| `https://api.ft.local/errors/forbidden`    | 403    | Insufficient permissions   |
| `https://api.ft.local/errors/not-found`    | 404    | Resource not found         |
| `https://api.ft.local/errors/conflict`     | 409    | Resource conflict          |
| `https://api.ft.local/errors/rate-limited` | 429    | Too many requests          |

### Implementation Notes

- Create Elysia error handler plugin to format all errors as Problem Details
- Define TypeBox schemas for typed error responses
- Use `Content-Type: application/problem+json` for all error responses
- Error `type` URIs should be resolvable (serve documentation at those URLs)
