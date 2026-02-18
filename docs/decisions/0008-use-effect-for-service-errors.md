# Use Effect for Service-Layer Error Handling

## Status

Superseded by [ADR 0008: neverthrow for Service Errors](./0008-use-neverthrow-for-service-errors.md)

## Context and Problem Statement

The ft_transcendence backend needs a consistent approach to error handling and
dependency management within the service layer. Currently, errors can be handled
via:

- Throwing exceptions (implicit control flow, invisible in type signatures)
- Returning null/undefined (loses error context)
- Ad-hoc error objects (inconsistent structure)

Additionally, services depend on repositories for database access. Without a
structured dependency model, testing requires mocking frameworks or global state
manipulation.

How should services handle errors and dependencies in a type-safe, composable
way that integrates with our RFC 9457 API error responses and enables clean
testing?

## Decision Drivers

- TypeScript should know all possible error types at compile time
- Domain errors (not found, validation failed) are not exceptions — they are
  expected outcomes that deserve first-class representation
- Service functions should compose cleanly without nested try-catch
- Dependencies (repositories) should be injectable for testing without mocking
  libraries
- Must integrate with RFC 9457 Problem Details for API responses
- Should support async operations seamlessly
- Pattern should be learnable from a single module example and then copy-pasted

## Considered Options

- Throwing exceptions with try-catch
- Returning union types manually (`T | Error`)
- Effect with typed errors, generators, and dependency injection via Layers

## Decision Outcome

Chosen option: "Effect", because it provides typed errors as values, composable
pipelines via generators, and built-in dependency injection via Context Tags and
Layers — solving error handling, composition, and testability in one coherent
model.

### Consequences

#### Positive

- **Typed errors**: `Data.TaggedError` creates discriminated unions with `_tag`
  — the compiler enforces exhaustive handling
- **Errors as values**: `Effect.fail` makes failure an explicit return path, not
  hidden control flow
- **Composable**: `Effect.gen` with `yield*` reads like async/await but
  short-circuits on failure automatically
- **Dependency injection**: `Context.Tag` + `Layer` provides compile-time
  checked DI — no runtime DI container, no decorators
- **Testable**: Swap `RepositoryLive` for `RepositoryTest` Layer — no mocking
  libraries needed
- **Integrates with RFC 9457**: Error `_tag` maps directly to Problem Details
  responses in controllers

#### Negative

- **Learning curve**: Team must learn generator syntax (`yield*`) and the Layer
  concept
- **Dependency size**: Effect is a larger library than minimal alternatives
- **Consistency required**: All services must follow the pattern — mixing
  throw/Effect creates confusion

### Confirmation

The decision will be confirmed by:

- Services returning `Effect.Effect<T, E, R>` with explicit error and dependency
  types
- Controllers running Effects via `Effect.runPromise` + `Effect.match`
- Repositories defined as `Context.Tag` with `Live` and `Test` Layer
  implementations
- No thrown exceptions for expected domain errors in services
- Error `_tag` values mapped to RFC 9457 responses in controllers

## Pros and Cons of the Options

### Throwing Exceptions

- Good, because familiar to most developers
- Good, because less verbose for simple cases
- Bad, because errors are invisible in type signatures
- Bad, because easy to forget error handling (no compiler help)
- Bad, because nested try-catch creates pyramid of doom
- Bad, because conflates domain errors with system failures

### Manual Union Types (`T | Error`)

- Good, because no dependencies
- Good, because explicit in type signatures
- Bad, because no standard combinators (map, flatMap, match)
- Bad, because manual type narrowing is tedious
- Bad, because no solution for dependency injection

### Effect

- Good, because full type safety with inference across error and dependency
  channels
- Good, because generator syntax reads like imperative code
- Good, because `Context.Tag` + `Layer` solves DI without frameworks
- Good, because `Effect.match` enforces exhaustive error handling
- Good, because single library solves errors, composition, and DI
- Bad, because unfamiliar syntax for developers new to Effect
- Bad, because requires consistent adoption across all services

## More Information

### Core Concept

Effect models computations as values with three type parameters:

```typescript
Effect.Effect<Success, Error, Requirements>;
//            ↑        ↑      ↑
//            value    typed   dependencies
//            on       errors  needed to run
//            success
```

A service function declares what it returns, what can go wrong, and what it
needs — all in the type signature.

### Error Types

Define domain errors with `Data.TaggedError`:

```typescript
// users.errors.ts
import { Data } from "effect";

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly userId: number;
}> {}

export class UsernameTaken extends Data.TaggedError("UsernameTaken")<{
  readonly username: string;
}> {}
```

Each error gets a `_tag` discriminant automatically. Include context (IDs,
names) for useful error messages.

### Repository Pattern

Repositories are defined as Context Tags with Live and Test implementations:

```typescript
// users.repository.ts
import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { db } from "../../db";
import { DatabaseError } from "../../common/errors";

export class UsersRepository extends Context.Tag("UsersRepository")<
  UsersRepository,
  {
    readonly findById: (
      id: number,
    ) => Effect.Effect<User | null, DatabaseError>;
    readonly create: (data: NewUser) => Effect.Effect<User, DatabaseError>;
  }
>() {}

// Production: real database
export const UsersRepositoryLive = Layer.succeed(UsersRepository, {
  findById: (id) =>
    Effect.tryPromise({
      try: () => db.select().from(users).where(eq(users.id, id)),
      catch: (e) => new DatabaseError({ cause: e }),
    }).pipe(Effect.map((rows) => rows[0] ?? null)),

  create: (data) =>
    Effect.tryPromise({
      try: () => db.insert(users).values(data).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    }).pipe(Effect.map((rows) => rows[0]!)),
});

// Test: in-memory, no database needed
export const UsersRepositoryTest = Layer.succeed(UsersRepository, {
  findById: (id) => Effect.succeed(id === 1 ? mockUser : null),
  create: (data) => Effect.succeed({ id: 1, ...data, createdAt: new Date() }),
});
```

### Service Pattern

Services use `Effect.gen` for composable, short-circuiting pipelines:

```typescript
// users.service.ts
import { Effect } from "effect";
import { UsersRepository } from "./users.repository";
import { UserNotFound } from "./users.errors";

export const getUserById = (
  id: number,
): Effect.Effect<User, UserNotFound | DatabaseError, UsersRepository> =>
  Effect.gen(function* () {
    const repo = yield* UsersRepository;
    const user = yield* repo.findById(id);
    if (!user) return yield* Effect.fail(new UserNotFound({ userId: id }));
    return user;
  });
```

The return type
`Effect.Effect<User, UserNotFound | DatabaseError, UsersRepository>` tells you
everything: it produces a `User`, can fail with `UserNotFound` or
`DatabaseError`, and requires a `UsersRepository` to run.

### Controller Pattern

Controllers provide the Layer, run the Effect, and map errors to HTTP:

```typescript
// users.controller.ts
import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { getUserById } from "./users.service";
import { UsersRepositoryLive } from "./users.repository";
import { problemDetails } from "../../common/problem-details";

export const usersController = new Elysia({ prefix: "/api/users" }).get(
  "/:id",
  async ({ params }) => {
    const program = getUserById(params.id).pipe(
      Effect.provide(UsersRepositoryLive),
    );

    return Effect.runPromise(
      program.pipe(
        Effect.match({
          onSuccess: (user) => ({ id: user.id, username: user.username }),
          onFailure: (error) => {
            switch (error._tag) {
              case "UserNotFound":
                return problemDetails(
                  404,
                  "not-found",
                  "User not found",
                  `User ${error.userId} does not exist`,
                );
              case "DatabaseError":
                return problemDetails(
                  500,
                  "internal",
                  "Internal error",
                  "An unexpected error occurred",
                );
            }
          },
        }),
      ),
    );
  },
  { params: t.Object({ id: t.Numeric() }) },
);
```

### Test Pattern

Tests swap the Live Layer for a Test Layer — no mocking library needed:

```typescript
// users.test.ts
import { Effect } from "effect";
import { describe, expect, test } from "bun:test";
import { getUserById } from "./users.service";
import { UsersRepositoryTest } from "./users.repository";

describe("getUserById", () => {
  test("returns user when found", async () => {
    const result = await Effect.runPromise(
      getUserById(1).pipe(Effect.provide(UsersRepositoryTest)),
    );
    expect(result.id).toBe(1);
  });

  test("fails with UserNotFound when missing", async () => {
    const result = await Effect.runPromise(
      getUserById(999).pipe(
        Effect.provide(UsersRepositoryTest),
        Effect.match({
          onSuccess: () => null,
          onFailure: (e) => e,
        }),
      ),
    );
    expect(result?._tag).toBe("UserNotFound");
  });
});
```

### When to Use Effect.fail vs throw

| Scenario                                       | Approach               |
| ---------------------------------------------- | ---------------------- |
| Expected domain errors (not found, validation) | `Effect.fail(new ...)` |
| Unexpected system failures (DB down, OOM)      | `throw` (let it crash) |
| Wrapping external library promises             | `Effect.tryPromise`    |

### What We Use from Effect

The project uses a focused subset:

| Used                            | Not Used                  |
| ------------------------------- | ------------------------- |
| `Effect.gen` + `yield*`         | Stream, Queue, Fiber      |
| `Effect.fail`, `Effect.succeed` | Schedule, STM             |
| `Context.Tag` + `Layer`         | Metrics, Tracing          |
| `Effect.provide`                | Pool, Dequeue             |
| `Effect.match`                  | Config, Secret            |
| `Data.TaggedError`              | Effect.retry, Effect.race |
| `Effect.tryPromise`             | Ref, FiberRef             |

### References

- [Effect documentation](https://effect.website)
- [Effect GitHub](https://github.com/Effect/effect)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [ADR 0005: RFC 9457 Problem Details](./0005-use-rfc9457-problem-details-for-errors.md)
