# Use neverthrow for Service-Layer Error Handling

## Status

Accepted (supersedes Effect evaluation in
[ADR 0009: Effect for Service Errors](./0009-use-effect-for-service-errors.md))

## Context and Problem Statement

The ft_transcendence backend needs a consistent approach to error handling
within the service layer. Currently, errors can be handled via:

- Throwing exceptions (implicit control flow)
- Returning null/undefined (loses error context)
- Ad-hoc error objects (inconsistent structure)

How should services communicate errors to controllers in a type-safe, composable
way that integrates with our RFC 9457 API error responses?

## Decision Drivers

- TypeScript should know all possible error types at compile time
- Errors should be explicit values, not hidden control flow
- Service functions should compose cleanly (no nested try-catch)
- Must integrate with RFC 9457 Problem Details for API responses
- Should support async operations seamlessly
- Team should be able to learn the pattern quickly

## Considered Options

- Throwing exceptions with try-catch
- Returning union types manually (`T | Error`)
- Using `neverthrow` Result types with Railway Oriented Programming

## Decision Outcome

Chosen option: "neverthrow with Railway Oriented Programming", because it
provides type-safe, composable error handling that makes all failure modes
explicit while keeping code readable.

### Consequences

#### Positive

- **Type-safe**: All error types are known at compile time via discriminated
  unions
- **Composable**: Chain operations with `.andThen()` without nested try-catch
  blocks
- **Explicit**: Errors are values—impossible to forget to handle them
- **Readable**: Linear pipeline flow instead of branching control flow
- **Async-friendly**: `ResultAsync` works seamlessly with promises
- **Integrates with RFC 9457**: Error types map cleanly to Problem Details
  responses

#### Negative

- **Learning curve**: Team must understand Result types and railway metaphor
- **Verbosity**: More explicit than try-catch for simple cases
- **Dependency**: Adds `neverthrow` as a runtime dependency

### Confirmation

The decision will be confirmed by:

- Services returning `Result<T, E>` or `ResultAsync<T, E>` types
- Controllers using `.match()` to convert Results to HTTP responses
- No thrown exceptions for expected error cases in services
- Error types documented and mapped to RFC 9457 Problem Details

## Pros and Cons of the Options

### Throwing Exceptions

- Good, because familiar to most developers
- Good, because less verbose for simple cases
- Bad, because errors are invisible in type signatures
- Bad, because easy to forget error handling
- Bad, because nested try-catch creates pyramid of doom
- Bad, because exceptions are slow compared to value returns

### Manual Union Types (`T | Error`)

- Good, because no dependencies
- Good, because explicit in type signatures
- Bad, because no standard combinators (map, andThen)
- Bad, because manual type narrowing is tedious
- Bad, because inconsistent patterns across codebase

### neverthrow with ROP

- Good, because full type safety with inference
- Good, because rich combinator library (map, andThen, combine)
- Good, because ResultAsync handles promises elegantly
- Good, because industry-proven pattern from functional programming
- Good, because small dependency (~3KB minified)
- Bad, because unfamiliar to developers without FP background
- Bad, because requires consistent adoption across services

## More Information

### Railway Oriented Programming Concept

ROP models operations as a two-track railway:

```
Input → [Validate] → [Transform] → [Save] → Output
           ↓             ↓            ↓
         Error ─────────────────────────→ Error
```

Once on the failure track, subsequent operations are bypassed until the end.

### Core Types

```typescript
import { ok, err, Result, ResultAsync } from 'neverthrow'

// Synchronous result
type Result<T, E> = Ok<T, E> | Err<T, E>

// Async result (wraps Promise<Result<T, E>>)
type ResultAsync<T, E> = ...

// Creating results
const success = ok(42)           // Result<number, never>
const failure = err('not found') // Result<never, string>
```

### Key Combinators

| Method       | Purpose                          | Signature                           |
| ------------ | -------------------------------- | ----------------------------------- |
| `.map()`     | Transform success value          | `(T → U) → Result<U, E>`            |
| `.mapErr()`  | Transform error value            | `(E → F) → Result<T, F>`            |
| `.andThen()` | Chain Result-returning functions | `(T → Result<U, E>) → Result<U, E>` |
| `.match()`   | Handle both tracks               | `(onOk, onErr) → U`                 |
| `combine()`  | Merge multiple Results           | `Result<T, E>[] → Result<T[], E>`   |

### Error Type Pattern

Define discriminated unions for domain errors:

```typescript
// Domain error types
type AuthError =
  | { type: "invalid_credentials" }
  | { type: "account_locked"; until: Date }
  | { type: "email_not_verified" };

type UserError =
  | { type: "not_found"; userId: string }
  | { type: "username_taken"; username: string };

// Service returns explicit error types
function authenticate(
  email: string,
  password: string,
): ResultAsync<User, AuthError>;
```

### Integration with RFC 9457

Controllers map Result errors to Problem Details:

```typescript
// In controller
const result = await authService.authenticate(email, password);

return result.match(
  (user) => ({ user: userToDto(user) }),
  (error) => {
    switch (error.type) {
      case "invalid_credentials":
        return problemDetails(401, "unauthorized", "Invalid email or password");
      case "account_locked":
        return problemDetails(
          403,
          "forbidden",
          `Account locked until ${error.until}`,
        );
      case "email_not_verified":
        return problemDetails(403, "forbidden", "Please verify your email");
    }
  },
);
```

### When to Use Exceptions vs Results

| Scenario                                         | Approach                            |
| ------------------------------------------------ | ----------------------------------- |
| Expected business errors (validation, not found) | `Result`                            |
| Unexpected system errors (DB down, OOM)          | Throw exception                     |
| External library errors                          | Wrap in `ResultAsync.fromPromise()` |

### References

- [neverthrow documentation](https://github.com/supermacro/neverthrow)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [ADR 005: RFC 9457 Problem Details](/decisions/0005-use-rfc9457-problem-details-for-errors)
