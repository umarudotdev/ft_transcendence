# Contributing

Development workflow and coding standards for ft_transcendence.

## Setup

See [README.md](README.md) for installation. **Dev Container recommended** to
avoid environment issues.

---

## Workflow

### 1. Branch

We follow [Conventional Branch](https://conventional-branch.github.io/) naming.

```bash
git checkout main && git pull
git checkout -b type/description
```

**Format:** `<type>/<description>`

- Use lowercase letters, numbers, and hyphens only
- Keep descriptions concise but clear

**Types:** `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs`, `test`,
`release`

**Examples:** `feat/paddle-physics`, `fix/session-expiry`,
`hotfix/security-patch`

### 2. Implement

Follow vertical slice pattern:

```
# API
apps/api/src/modules/myfeature/
├── myfeature.controller.ts   # Routes + validation (NO DB calls)
├── myfeature.service.ts      # Business logic
├── myfeature.repository.ts   # Drizzle queries
└── myfeature.model.ts        # TypeBox schemas

# Web
apps/web/src/routes/myfeature/+page.svelte
apps/web/src/lib/components/myfeature/
```

### 3. Commit

We follow
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`chore`, `ci`

**Breaking changes:** Add `!` before the colon (e.g.,
`feat(api)!: remove deprecated endpoint`)

**Examples:**

- `feat(game): add ball collision detection`
- `fix(frontend): resolve hydration error`
- `docs: update API documentation`
- `refactor(auth)!: change session token format`

Commit messages are validated automatically. Non-compliant commits will be
rejected.

### 4. Push & PR

```bash
git push -u origin type/description
```

- Target: `main`
- Requires: 1 approval, passing CI
- Strategy: Squash and merge
- Linear history required — rebase onto `main` before merging

---

## Coding Standards

### Backend

Follow [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice).

| Layer      | Rules                                                |
| ---------- | ---------------------------------------------------- |
| Controller | HTTP + TypeBox validation only. **Never call DB.**   |
| Service    | Business logic. Framework-agnostic where possible.   |
| Repository | **Only** place for `db.select/insert/update/delete`. |
| Domain     | Pure TS (game module). No framework imports.         |

**Controllers** — Destructure context properties; never pass the entire
`Context` object to services:

```typescript
// Good: destructure specific properties
export const userController = new Elysia({ prefix: "/users" })
  .get("/me", ({ user }) => userService.getProfile(user.id))
  .patch("/me", ({ user, body }) => userService.updateProfile(user.id, body), {
    body: t.Object({
      username: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
    }),
  });

// Bad: passing entire context
.get("/me", (ctx) => userService.getProfile(ctx))
```

**Services** — Use abstract classes with static methods for stateless business
logic:

```typescript
abstract class UserService {
  static getProfile(userId: string) {
    return userRepository.findById(userId);
  }
}
```

**Models** (`model.ts`) — TypeBox schemas are the single source of truth for
types:

```typescript
// model.ts — define schemas and derive types together
export const signInBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
});
export type SignInBody = typeof signInBody.static;

// Don't declare separate interfaces
```

### Frontend

- **Always use Eden Treaty** — never raw `fetch()`
- Server data → SvelteKit `load` functions
- Client state → Svelte stores
- Real-time → WebSocket writes to stores

### TypeScript

- No `any` — use `unknown` + type guards
- No `@ts-ignore` — fix the error
- Prefer `interface` over `type` for objects
- Handle `null`/`undefined` explicitly

---

## Database Changes

1. Edit `apps/api/src/db/schema.ts`
2. Run `cd apps/api && bun run migrate`
3. Commit schema + migration files

**Never** modify DB directly via GUI.

---

## Changelog

We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Update `CHANGELOG.md` with every user-facing change. Add entries under
**Unreleased** using these categories:

| Category       | Use for                      |
| -------------- | ---------------------------- |
| **Added**      | New features                 |
| **Changed**    | Changes to existing features |
| **Deprecated** | Features marked for removal  |
| **Removed**    | Removed features             |
| **Fixed**      | Bug fixes                    |
| **Security**   | Vulnerability patches        |

**Rules:**

- Write for humans, not machines — explain impact, not implementation
- Use ISO 8601 dates (`YYYY-MM-DD`)
- Latest version first
- Don't copy commit messages — summarize user-facing changes

---

## Pre-commit Hooks

Pre-commit checks run automatically:

| Check        | Fixes                                 |
| ------------ | ------------------------------------- |
| Biome        | `bun run biome check --apply .`       |
| Prettier     | `bunx prettier --write "**/*.svelte"` |
| TypeScript   | `bun run tsc --noEmit`                |
| svelte-check | `cd apps/web && bun run check`        |
| Commitlint   | Re-commit with valid message          |

---

## PR Checklist

- [ ] Branch up to date with `main`
- [ ] Follows vertical slice pattern
- [ ] No `any` or `@ts-ignore`
- [ ] Eden Treaty for API calls
- [ ] Database changes include migrations
- [ ] Changelog updated (if user-facing)
- [ ] Works in Docker
- [ ] Self-reviewed diff

---

## Troubleshooting

```bash
# Reset Docker
docker compose down -v && docker compose up --build

# View logs
docker compose logs -f api

# Reset dependencies
rm -rf node_modules apps/*/node_modules && bun install

# Connect to DB
docker compose exec db psql -U postgres -d ft_transcendence
```
