# Tutorial: Railway Oriented Programming with neverthrow

> **Difficulty:** Intermediate | **Time:** 2-3 hours | **Prerequisites:**
> Completed Tutorial 01, basic TypeScript, understanding of async/await

## What You'll Learn

- Understanding the "two-track" railway model for error handling
- Using `neverthrow` Result types instead of exceptions
- Composing operations with `map`, `andThen`, and `match`
- Handling async operations with `ResultAsync`
- Combining multiple Results for validation
- Integrating with RFC 9457 Problem Details responses

## Conceptual Overview

### The Problem with Exceptions

Traditional error handling uses exceptions:

```typescript
// The problem: errors are invisible
async function createUser(data: UserInput): Promise<User> {
  const existing = await db.findByEmail(data.email);
  if (existing) throw new Error("Email taken"); // Hidden in type signature!

  const hashed = await hashPassword(data.password);
  return db.insert({ ...data, password: hashed });
}

// Caller has no idea what can fail
try {
  const user = await createUser(input);
} catch (e) {
  // What errors are possible? We have no idea.
}
```

Problems:

1. **Hidden control flow** — `throw` jumps to unknown catch block
2. **No type safety** — TypeScript doesn't track thrown errors
3. **Easy to forget** — Nothing forces you to handle errors
4. **Pyramid of doom** — Nested try-catch is hard to read

### Railway Oriented Programming

ROP models your code as a two-track railway:

```
     Success Track (green)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ Output
Input ──▶ [Validate] ──▶ [Transform] ──▶ [Save] ──▶
              │              │            │
              ▼              ▼            ▼
     ─────────────────────────────────────────────▶ Error
     Failure Track (red)
```

**Key insight**: Once on the failure track, all subsequent operations are
**bypassed**. The error flows straight to the end.

### The Result Type

A `Result<T, E>` is either:

- `Ok<T>` — success with a value of type `T`
- `Err<E>` — failure with an error of type `E`

```typescript
import { err, ok, Result } from "neverthrow";

// Success
const success: Result<number, string> = ok(42);

// Failure
const failure: Result<number, string> = err("something went wrong");
```

TypeScript **knows** this can fail. You can't access the value without handling
both cases.

---

## Phase 1: Basic Result Operations

### Learning Objective

Use `ok`, `err`, `map`, and `match` to handle simple success/failure cases.

### Step 1.1: Creating Results

```typescript
import { err, ok, Result } from "neverthrow";

// Domain error type (discriminated union)
type DivisionError = { type: "division_by_zero" };

function divide(a: number, b: number): Result<number, DivisionError> {
  if (b === 0) {
    return err({ type: "division_by_zero" });
  }
  return ok(a / b);
}

// Usage
const result = divide(10, 2); // Result<number, DivisionError>
```

### Step 1.2: Transforming Success with `map`

`map` transforms the success value, leaving errors untouched:

```typescript
const doubled = divide(10, 2)
  .map((n) => n * 2); // Only runs if divide succeeded

// doubled: Result<number, DivisionError>
// If ok: Ok(10)
// If err: Err({ type: 'division_by_zero' }) — unchanged
```

Think of `map` as "if this succeeded, then also do this".

### Step 1.3: Transforming Errors with `mapErr`

`mapErr` transforms error values:

```typescript
const withMessage = divide(10, 0)
  .mapErr((e) => ({ ...e, message: "Cannot divide by zero" }));

// Err({ type: 'division_by_zero', message: 'Cannot divide by zero' })
```

### Step 1.4: Handling Both Tracks with `match`

`match` forces you to handle both success and failure:

```typescript
const message = divide(10, 2).match(
  (value) => `Result: ${value}`, // Success handler
  (error) => `Error: ${error.type}`, // Error handler
);
// message: string (TypeScript knows!)
```

This is how you "exit" the railway—by explicitly handling both tracks.

### Exercise 1

Create a `parsePositiveInt` function that returns `Result<number, ParseError>`:

```typescript
type ParseError =
  | { type: "not_a_number"; input: string }
  | { type: "not_positive"; value: number };

function parsePositiveInt(input: string): Result<number, ParseError> {
  // Your implementation
}

// Should work:
parsePositiveInt("42"); // Ok(42)
parsePositiveInt("abc"); // Err({ type: 'not_a_number', input: 'abc' })
parsePositiveInt("-5"); // Err({ type: 'not_positive', value: -5 })
```

<details>
<summary>Solution</summary>

```typescript
function parsePositiveInt(input: string): Result<number, ParseError> {
  const num = parseInt(input, 10);

  if (isNaN(num)) {
    return err({ type: "not_a_number", input });
  }

  if (num <= 0) {
    return err({ type: "not_positive", value: num });
  }

  return ok(num);
}
```

</details>

---

## Phase 2: Chaining Operations with `andThen`

### Learning Objective

Chain multiple Result-returning operations without nested conditionals.

### Understanding `andThen`

`map` is for functions that **can't fail**: `(T) => U`

`andThen` is for functions that **can fail**: `(T) => Result<U, E>`

```typescript
// This won't compile — map expects (number) => U, not (number) => Result
divide(10, 2).map((n) => divide(n, 2)); // ❌ Result<Result<number, E>, E>

// Use andThen for Result-returning functions
divide(10, 2).andThen((n) => divide(n, 2)); // ✅ Result<number, E>
```

### Step 2.1: Building a Pipeline

```typescript
type MathError =
  | { type: "division_by_zero" }
  | { type: "negative_sqrt"; value: number };

function safeSqrt(n: number): Result<number, MathError> {
  if (n < 0) return err({ type: "negative_sqrt", value: n });
  return ok(Math.sqrt(n));
}

function divide(a: number, b: number): Result<number, MathError> {
  if (b === 0) return err({ type: "division_by_zero" });
  return ok(a / b);
}

// Chain operations: divide, then sqrt, then double
function compute(a: number, b: number): Result<number, MathError> {
  return divide(a, b)
    .andThen(safeSqrt) // Only runs if divide succeeded
    .map((n) => n * 2); // Only runs if sqrt succeeded
}

compute(16, 4); // Ok(4) — sqrt(4) * 2
compute(16, 0); // Err({ type: 'division_by_zero' })
compute(-16, -4); // Err({ type: 'negative_sqrt', value: 4 })
```

Notice: **no if statements, no try-catch**. The railway handles the flow.

### Step 2.2: Real-World Example — User Registration

```typescript
type RegistrationError =
  | { type: "invalid_email"; email: string }
  | { type: "weak_password"; reason: string }
  | { type: "username_taken"; username: string };

function validateEmail(email: string): Result<string, RegistrationError> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return err({ type: "invalid_email", email });
  }
  return ok(email);
}

function validatePassword(password: string): Result<string, RegistrationError> {
  if (password.length < 8) {
    return err({
      type: "weak_password",
      reason: "Must be at least 8 characters",
    });
  }
  return ok(password);
}

function checkUsernameAvailable(
  username: string,
): Result<string, RegistrationError> {
  const taken = ["admin", "root", "system"];
  if (taken.includes(username.toLowerCase())) {
    return err({ type: "username_taken", username });
  }
  return ok(username);
}

// Validate all fields in sequence
function validateRegistration(input: {
  email: string;
  password: string;
  username: string;
}): Result<typeof input, RegistrationError> {
  return validateEmail(input.email)
    .andThen(() => validatePassword(input.password))
    .andThen(() => checkUsernameAvailable(input.username))
    .map(() => input); // Return original input if all passed
}
```

---

## Phase 3: Async Operations with `ResultAsync`

### Learning Objective

Handle async operations (database calls, API requests) with `ResultAsync`.

### Understanding `ResultAsync`

`ResultAsync<T, E>` is a `Promise<Result<T, E>>` with built-in combinators:

```typescript
import { errAsync, okAsync, ResultAsync } from "neverthrow";

// Creating async results
const asyncSuccess = okAsync(42); // ResultAsync<number, never>
const asyncFailure = errAsync("oops"); // ResultAsync<never, string>

// From promises
const fromPromise = ResultAsync.fromPromise(
  fetch("/api/user"),
  (error) => ({ type: "network_error", cause: error }),
);
```

### Step 3.1: Wrapping Database Operations

```typescript
import { ResultAsync } from "neverthrow";

type DbError = { type: "db_error"; message: string };
type NotFoundError = { type: "not_found"; id: string };

type UserError = DbError | NotFoundError;

function findUserById(id: string): ResultAsync<User, UserError> {
  return ResultAsync.fromPromise(
    db.query.users.findFirst({ where: eq(users.id, id) }),
    (e) => ({ type: "db_error", message: String(e) }),
  ).andThen((user) =>
    user ? okAsync(user) : errAsync({ type: "not_found", id })
  );
}
```

### Step 3.2: Chaining Async Operations

```typescript
type ProfileError = UserError | { type: "no_avatar" };

function getUserWithAvatar(
  userId: string,
): ResultAsync<UserWithAvatar, ProfileError> {
  return findUserById(userId)
    .andThen((user) =>
      user.avatarId
        ? findAvatarById(user.avatarId).map((avatar) => ({ ...user, avatar }))
        : errAsync({ type: "no_avatar" })
    );
}
```

### Step 3.3: Full Service Example

```typescript
// auth.service.ts
import { errAsync, okAsync, ResultAsync } from "neverthrow";

type AuthError =
  | { type: "invalid_credentials" }
  | { type: "account_locked"; until: Date }
  | { type: "db_error"; message: string };

export function authenticate(
  email: string,
  password: string,
): ResultAsync<User, AuthError> {
  return findUserByEmail(email)
    .andThen((user) =>
      user ? okAsync(user) : errAsync({ type: "invalid_credentials" })
    )
    .andThen((user) =>
      user.lockedUntil && user.lockedUntil > new Date()
        ? errAsync({ type: "account_locked", until: user.lockedUntil })
        : okAsync(user)
    )
    .andThen((user) =>
      verifyPassword(password, user.passwordHash)
        .map(() => user)
    );
}
```

---

## Phase 4: Combining Multiple Results

### Learning Objective

Validate multiple fields and collect all errors (not just the first).

### `combine` — Fail Fast

`combine` returns the **first error** encountered:

```typescript
import { combine } from "neverthrow";

const results = combine([
  validateEmail(email),
  validatePassword(password),
  validateUsername(username),
]);
// Result<[string, string, string], RegistrationError>
// Returns first error only
```

### `combineWithAllErrors` — Collect All Errors

For validation, you often want **all** errors:

```typescript
import { combineWithAllErrors } from "neverthrow";

const results = combineWithAllErrors([
  validateEmail(email),
  validatePassword(password),
  validateUsername(username),
]);
// Result<[string, string, string], RegistrationError[]>
// Returns array of ALL errors
```

### Step 4.1: Form Validation Example

```typescript
type ValidationError = {
  field: string;
  message: string;
};

function validateField(
  field: string,
  value: string,
  validator: (v: string) => boolean,
  message: string,
): Result<string, ValidationError> {
  return validator(value) ? ok(value) : err({ field, message });
}

function validateRegistrationForm(
  form: RegistrationForm,
): Result<RegistrationForm, ValidationError[]> {
  return combineWithAllErrors([
    validateField("email", form.email, isValidEmail, "Invalid email format"),
    validateField(
      "password",
      form.password,
      isStrongPassword,
      "Password too weak",
    ),
    validateField(
      "username",
      form.username,
      isValidUsername,
      "Invalid username",
    ),
  ]).map(() => form);
}

// Usage
const result = validateRegistrationForm(formData);

result.match(
  (form) => console.log("Valid:", form),
  (errors) => {
    // errors: ValidationError[]
    for (const error of errors) {
      console.log(`${error.field}: ${error.message}`);
    }
  },
);
```

---

## Phase 5: Integration with Controllers

### Learning Objective

Convert Result types to RFC 9457 Problem Details HTTP responses.

### Step 5.1: Error Mapping Helper

```typescript
// lib/problem-details.ts
import { error } from "elysia";

type ProblemDetails = {
  type: string;
  status: number;
  title: string;
  detail: string;
  instance?: string;
};

export function problemDetails(
  status: number,
  errorType: string,
  detail: string,
  extensions?: Record<string, unknown>,
): ProblemDetails {
  return {
    type: `https://api.ft.local/errors/${errorType}`,
    status,
    title: errorType.replace(/-/g, " ").replace(
      /\b\w/g,
      (c) => c.toUpperCase(),
    ),
    detail,
    ...extensions,
  };
}
```

### Step 5.2: Controller Pattern

```typescript
// auth.controller.ts
import { Elysia } from "elysia";
import { authService } from "./auth.service";
import { problemDetails } from "../lib/problem-details";

export const authController = new Elysia({ prefix: "/auth" })
  .post("/login", async ({ body }) => {
    const { email, password } = body;

    const result = await authService.authenticate(email, password);

    return result.match(
      (user) => ({
        user: { id: user.id, email: user.email, username: user.username },
      }),
      (error) => {
        switch (error.type) {
          case "invalid_credentials":
            throw problemDetails(
              401,
              "unauthorized",
              "Invalid email or password",
            );

          case "account_locked":
            throw problemDetails(
              403,
              "forbidden",
              `Account locked until ${error.until.toISOString()}`,
              {
                retryAfter: Math.ceil(
                  (error.until.getTime() - Date.now()) / 1000,
                ),
              },
            );

          case "db_error":
            throw problemDetails(
              500,
              "internal-error",
              "An unexpected error occurred",
            );
        }
      },
    );
  });
```

### Step 5.3: Validation Errors Pattern

```typescript
.post('/register', async ({ body }) => {
  const result = await userService.register(body)

  return result.match(
    (user) => ({ user: userToDto(user) }),
    (errors) => {
      // Handle array of validation errors
      if (Array.isArray(errors)) {
        throw problemDetails(422, 'validation', 'Validation failed', {
          errors: errors.map(e => ({ field: e.field, message: e.message }))
        })
      }
      // Handle single error
      throw problemDetails(400, 'bad-request', errors.message)
    }
  )
})
```

---

## Summary

### Mental Model

Think of your code as trains on a railway:

1. **Start on success track** — `ok(value)`
2. **Switch to failure track** — `err(error)` or failed validation
3. **Stay on current track** — `map` and `andThen` only affect success track
4. **Exit at the end** — `match` handles both tracks

### When to Use What

| Combinator                    | Use When                              |
| ----------------------------- | ------------------------------------- |
| `ok(value)`                   | Creating a success                    |
| `err(error)`                  | Creating a failure                    |
| `.map(fn)`                    | Transform success, fn can't fail      |
| `.mapErr(fn)`                 | Transform error                       |
| `.andThen(fn)`                | Chain operations that can fail        |
| `.match(onOk, onErr)`         | Handle both cases at the end          |
| `combine([...])`              | Multiple results, fail on first error |
| `combineWithAllErrors([...])` | Multiple results, collect all errors  |

### Key Benefits

1. **Errors are values** — TypeScript tracks them
2. **Explicit handling** — Can't forget to handle errors
3. **Linear flow** — No nested try-catch pyramid
4. **Composable** — Build complex flows from simple functions
5. **Self-documenting** — Return type shows all failure modes

### Further Reading

- [ADR 008: neverthrow for Service Errors](/decisions/0008-use-neverthrow-for-service-errors)
- [ADR 005: RFC 9457 Problem Details](/decisions/0005-use-rfc9457-problem-details-for-errors)
- [Railway Oriented Programming (F# for Fun and Profit)](https://fsharpforfunandprofit.com/rop/)
