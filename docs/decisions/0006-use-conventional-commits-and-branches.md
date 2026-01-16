# Use Conventional Commits and Branch Naming

## Status

Accepted

## Context and Problem Statement

With multiple contributors working on ft_transcendence, we need consistent Git
practices for:

- Clear, scannable commit history
- Automated changelog generation potential
- Easy identification of breaking changes
- Consistent branch naming for CI/CD integration

How should we standardize our Git workflow?

## Decision Drivers

- Commits should clearly communicate intent (feature, fix, refactor, etc.)
- Breaking changes must be immediately visible
- Branch names should indicate purpose at a glance
- Tooling should enforce conventions automatically
- Workflow should be simple enough to not slow down development

## Considered Options

- No convention (freeform messages)
- Conventional Commits with Conventional Branch naming
- Gitmoji commit style

## Decision Outcome

Chosen option: "Conventional Commits with Conventional Branch naming", because
it provides machine-readable commit history, clear communication of intent, and
integrates well with tooling like Commitlint.

### Consequences

#### Positive

- Scannable history: Commit types visible at a glance
- Automation-ready: Can generate changelogs, determine version bumps
- Breaking change visibility: `!` suffix immediately flags breaking changes
- CI integration: Branch prefixes can trigger different workflows
- Enforced: Commitlint prevents non-conforming commits

#### Negative

- Learning curve: Contributors must learn the conventions
- Slightly longer commit messages due to type prefix

### Confirmation

The decision will be confirmed by:

- Commitlint rejecting non-conforming commit messages
- All commits in main branch following the convention
- Branch names consistently using type prefixes

## Pros and Cons of the Options

### No Convention (Freeform)

- Good, because no learning curve
- Good, because maximum flexibility
- Bad, because inconsistent history
- Bad, because no automation potential
- Bad, because breaking changes easily missed

### Conventional Commits + Conventional Branch

- Good, because clear, structured communication
- Good, because machine-readable for tooling
- Good, because breaking changes explicitly marked
- Good, because widely adopted standard
- Bad, because requires learning conventions
- Bad, because slightly more verbose

### Gitmoji

- Good, because visually scannable with emojis
- Good, because fun and expressive
- Bad, because emojis can be ambiguous
- Bad, because less tooling support than Conventional Commits
- Bad, because harder to grep/search

## More Information

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

| Type       | Description                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature                                     |
| `fix`      | Bug fix                                         |
| `docs`     | Documentation only                              |
| `style`    | Formatting, no code change                      |
| `refactor` | Code change that neither fixes nor adds feature |
| `perf`     | Performance improvement                         |
| `test`     | Adding or correcting tests                      |
| `build`    | Build system or external dependencies           |
| `ci`       | CI configuration                                |
| `chore`    | Other changes that don't modify src or test     |

**Scope** (optional): Module or area affected (e.g., `api`, `web`, `auth`,
`game`, `chat`)

**Breaking Changes:** Add `!` before the colon

```
feat(api)!: remove deprecated /v1 endpoints
```

### Examples

```bash
# Feature
feat(game): add paddle collision detection

# Bug fix
fix(auth): prevent session fixation on login

# Documentation
docs: update API authentication guide

# Breaking change
feat(api)!: change user response shape

# With body and footer
fix(chat): prevent XSS in message rendering

Sanitize user input before rendering in DOM.
Added DOMPurify for HTML sanitization.

Closes #123
```

### Branch Naming Format

```
<type>/<description>
```

Use kebab-case for description. Branch type should match commit type.

**Examples:**

```bash
feat/paddle-physics
fix/session-expiry
docs/api-authentication
refactor/game-loop
hotfix/security-patch
chore/upgrade-dependencies
```

### Tooling

- **Commitlint**: Enforces Conventional Commits format on commit
- **Husky**: Git hooks to run Commitlint pre-commit

### Workflow Example

```bash
# Create feature branch
git checkout -b feat/match-history

# Make commits
git commit -m "feat(game): add match result storage"
git commit -m "feat(api): add match history endpoint"
git commit -m "test(api): add match history tests"

# Push and create PR
git push -u origin feat/match-history
gh pr create --title "feat(game): add match history tracking"
```

### Commit Message Tips

1. **Use imperative mood**: "add feature" not "added feature"
2. **Don't capitalize first letter**: "fix bug" not "Fix bug"
3. **No period at the end**: "add feature" not "add feature."
4. **Keep subject under 72 characters**
5. **Separate subject from body with blank line**
6. **Use body to explain what and why, not how**
