# Use Monorepo with Vertical Slice Architecture

## Status

Accepted

## Context and Problem Statement

The ft_transcendence project involves distinct frontend and backend applications that share strict type definitions and validation schemas. The development team consists of 5 members working in parallel.

How should we structure the codebase to minimize merge conflicts, reduce cognitive load, and maintain end-to-end type safety between frontend and backend?

## Decision Drivers

- Enable parallel development by 5 team members with minimal merge conflicts
- Keep all code related to a feature co-located for easier navigation
- Support Eden Treaty type sharing between frontend and backend
- Enable modular architecture for future refactoring
- Reduce context switching when implementing features

## Considered Options

- Multi-repo with separate frontend and backend repositories
- Monorepo with Layered Architecture (controllers/, services/, models/)
- Monorepo with Vertical Slice Architecture (feature modules)

## Decision Outcome

Chosen option: "Monorepo with Vertical Slice Architecture", because it enables type sharing via Bun Workspaces, isolates features into self-contained modules reducing merge conflicts, and keeps related code co-located for better developer experience.

### Consequences

#### Positive

- Isolation: A developer working on "Chat" only touches the `modules/chat` folder, significantly reducing merge conflicts
- Cognitive Load: All code related to a feature is in one place
- Type Sharing: Monorepo structure allows Frontend to import Backend types directly via workspace linking
- Modularity: Features are isolated and independently testable

#### Negative

- Boilerplate: Each feature requires separate Controller, Service, and Repository files
- Discipline: Tech Lead must enforce "No DB in Controllers" rule during code reviews; framework does not prevent violations

### Confirmation

The decision will be confirmed by:

- Code review checklist enforcing separation of concerns
- Successful Eden Treaty type imports in frontend without manual duplication
- Feature branches isolated to single module directories

## Pros and Cons of the Options

### Multi-repo with Separate Repositories

- Good, because enforces strong boundaries between frontend and backend
- Good, because allows independent versioning and releases
- Bad, because type sharing requires publishing packages or complex linking
- Bad, because changes spanning frontend and backend require coordinating multiple PRs
- Bad, because duplicated CI/CD configuration

### Monorepo with Layered Architecture

- Good, because familiar pattern for developers with traditional MVC experience
- Good, because single repository for all code
- Bad, because features are smeared across the entire codebase (controllers/, services/, models/)
- Bad, because high probability of merge conflicts when multiple developers modify same files
- Bad, because requires jumping between 5+ folders to implement one feature

### Monorepo with Vertical Slice Architecture

- Good, because features are self-contained in dedicated modules
- Good, because parallel development with minimal conflicts
- Good, because Eden Treaty types are immediately available to frontend
- Good, because modules can be easily refactored or reorganized
- Bad, because requires discipline to maintain separation of concerns within slices
- Bad, because slightly more initial boilerplate per feature

## More Information

### Directory Structure

```
apps/
├── api/
│   └── src/modules/
│       ├── auth/           # Authentication slice
│       ├── chat/           # Chat system slice
│       └── game/           # Game engine slice
│           ├── game.controller.ts
│           ├── game.service.ts
│           ├── game.repository.ts
│           └── domain/     # Pure game logic
└── web/                    # SvelteKit client
packages/                   # Shared configs (optional)
```

### Separation of Concerns Pattern

1. **Controller** (`.controller.ts`): HTTP handling, input validation (TypeBox), serialization. Must NOT access database directly.
2. **Service** (`.service.ts`): Business logic, permission checks, orchestration. Framework-agnostic where possible.
3. **Repository** (`.repository.ts`): Drizzle ORM queries. The ONLY place where `db.select/insert` is allowed.
