# Use Bun-Elysia-SvelteKit Stack for ft_transcendence

## Status

Accepted

## Context and Problem Statement

The ft_transcendence project requires a full-stack web application with real-time capabilities (WebSockets), rigid security (HTTPS, 2FA), and a relational database. The team consists of 5 developers with varying levels of frontend/backend experience.

How do we select a technology stack that maximizes development velocity, ensures type safety across the full stack, and meets the 42 curriculum compliance requirements?

## Decision Drivers

- Minimize configuration time and "works on my machine" issues
- Support high-frequency game updates (60 tick/s) with low latency
- Prevent contract mismatch bugs between Frontend and Backend via type safety
- Must run via Docker and support the 42 "Module" grading system (SSR, ORM, Frameworks)
- Team has varying experience levels; prefer technologies with lower learning curves

## Considered Options

- Node.js + Express + React + Prisma
- Node.js + NestJS + Next.js + Prisma
- Bun + ElysiaJS + SvelteKit + Drizzle

## Decision Outcome

Chosen option: "Bun + ElysiaJS + SvelteKit + Drizzle", because it provides end-to-end type safety via Eden Treaty, eliminates build steps in development, and offers superior performance for real-time game updates while satisfying all compliance requirements.

### Consequences

#### Positive

- End-to-End Type Safety: Changes in the Backend API immediately flag errors in the Frontend IDE
- Unified Toolchain: Bun handles package management, bundling, and testing
- Development Speed: Developers write pure logic rather than boilerplate configuration
- Module Compliance: Satisfies Frontend Framework, Backend Framework, SSR, and ORM requirements

#### Negative

- Ecosystem Maturity: Elysia and Bun have smaller communities than Express/Node; we rely on official documentation rather than StackOverflow
- Learning Curve: Team must adapt to Svelte's syntax and Drizzle's SQL-like API

### Confirmation

The decision will be confirmed by:

- Successful Docker container builds on Alpine Linux
- Eden Treaty type inference working between frontend and backend
- Game loop achieving stable 60 tick/s performance in development

## Pros and Cons of the Options

### Node.js + Express + React + Prisma

- Good, because Express and React have the largest ecosystems and community support
- Good, because React has extensive documentation and third-party libraries for common use cases
- Bad, because no built-in end-to-end type safety between frontend and backend
- Bad, because Prisma requires a code generation step that adds complexity to the development workflow
- Bad, because React's Context API requires more boilerplate (~30 lines) than Svelte's built-in stores (~15 lines) for shared state

### Node.js + NestJS + Next.js + Prisma

- Good, because NestJS provides structured architecture patterns
- Good, because Next.js has mature SSR support
- Bad, because heavy abstraction layers increase cognitive overhead
- Bad, because no built-in end-to-end type safety between backend and frontend
- Bad, because steep learning curve across three complex frameworks

### Bun + ElysiaJS + SvelteKit + Drizzle

- Good, because Bun's unified toolchain reduces configuration complexity
- Good, because Eden Treaty enables automatic type-safe API client generation
- Good, because Svelte's simpler syntax lowers the learning curve
- Good, because Drizzle is TypeScript-native with zero runtime dependencies
- Bad, because smaller community means less available learning resources
- Bad, because Bun ecosystem is still maturing

## More Information

### Compliance Check

- [x] Web Application
- [x] Frontend Framework (SvelteKit)
- [x] Backend Framework (ElysiaJS)
- [x] Database (PostgreSQL)
- [x] SSR (SvelteKit - Minor Module 1pt)
- [x] ORM (Drizzle - Minor Module 1pt)
- [x] Containerization (Docker + Alpine support)
