# Use GitHub Flow Workflow

## Status

Accepted

## Context and Problem Statement

The team needs a branching strategy that supports continuous delivery while remaining simple enough for a small team. The workflow must integrate with our Conventional Commits and branch naming conventions.

How should we structure our Git branching and collaboration workflow?

## Decision Drivers

- Small team size (doesn't need complex release management)
- Continuous deployment to single environment
- Simple mental model for contributors
- Must integrate with Conventional Commits and branch naming
- Pull requests required for code review
- Linear commit history required (no merge commits)

## Considered Options

- GitFlow (develop, release, hotfix branches)
- GitHub Flow (main + feature branches)
- Trunk-based development (direct commits to main)

## Decision Outcome

Chosen option: "GitHub Flow", because it provides the right balance of simplicity and safety for a small team with continuous deployment, while still requiring code review via pull requests.

### Consequences

#### Positive

- Simple: Only one long-lived branch (master)
- Fast: Features go directly to production after review
- Clear: Branch purpose obvious from conventional name
- Safe: All changes go through PR review

#### Negative

- No staging: No built-in staging branch for integration testing
- Rollback: Must revert commits rather than delay release

### Confirmation

The decision will be confirmed by:

- All features developed on short-lived branches
- All merges to master going through pull requests
- No long-lived branches other than master

## Pros and Cons of the Options

### GitFlow

- Good, because clear separation between development and release
- Good, because supports multiple versions in production
- Bad, because complex for small teams
- Bad, because long-lived develop branch causes merge conflicts
- Bad, because overkill for single-environment deployment

### GitHub Flow

- Good, because simple mental model
- Good, because short-lived branches reduce conflicts
- Good, because continuous deployment friendly
- Good, because PRs ensure code review
- Bad, because no built-in staging environment
- Bad, because requires feature flags for incomplete features

### Trunk-Based Development

- Good, because fastest integration
- Good, because minimal branch management
- Bad, because requires extensive automated testing
- Bad, because no PR review gate
- Bad, because risky for less experienced teams

## More Information

### Workflow Overview

```
master (production-ready)
  │
  ├── feat/paddle-physics ──── PR ──┐
  │                                  │
  ├── fix/session-expiry ───── PR ──┼── master
  │                                  │
  └── docs/api-guide ───────── PR ──┘
```

### Branch Lifecycle

1. **Create branch** from master with conventional name
2. **Develop** with atomic, conventional commits
3. **Push** branch to remote
4. **Open PR** against master
5. **Review** and address feedback
6. **Merge** via squash or merge commit
7. **Delete** branch after merge

### Step-by-Step Workflow

```bash
# 1. Start from up-to-date master
git checkout master
git pull origin master

# 2. Create feature branch
git checkout -b feat/match-history

# 3. Make changes with conventional commits
git add .
git commit -m "feat(game): add match result model"
git commit -m "feat(api): add match history endpoint"

# 4. Push and create PR
git push -u origin feat/match-history
gh pr create --title "feat(game): add match history" --body "..."

# 5. After approval and merge, clean up
git checkout master
git pull origin master
git branch -d feat/match-history
```

### Pull Request Guidelines

**Title:** Use conventional commit format
```
feat(game): add match history tracking
```

**Body Template:**
```markdown
## Summary
- Added match result storage after game completion
- Created API endpoint for retrieving match history

## Test Plan
- [ ] Unit tests for match service
- [ ] Manual test: complete game and verify history
```

**Review Checklist:**
- [ ] Code follows project conventions
- [ ] Tests pass
- [ ] No security vulnerabilities
- [ ] Documentation updated if needed

### Merge Strategy

We require **linear history** — no merge commits allowed on master.

**Option 1: Squash merge** (preferred for feature branches)
```bash
gh pr merge --squash
```
Combines all branch commits into a single commit with the PR title as message.

**Option 2: Rebase merge** (for clean multi-commit PRs)
```bash
gh pr merge --rebase
```
Replays each commit on top of master, preserving individual commits.

### Keeping Branches Up to Date

When master has new commits, rebase your branch (never merge master into your branch):

```bash
# Update local master
git checkout master
git pull origin master

# Rebase feature branch
git checkout feat/my-feature
git rebase master

# Force push rebased branch
git push --force-with-lease
```

Use `--force-with-lease` instead of `--force` to prevent overwriting others' work.

### Handling Hotfixes

For urgent production fixes:

```bash
# Create hotfix branch
git checkout -b hotfix/security-patch

# Fix and commit
git commit -m "fix(auth): patch session vulnerability"

# Create PR with expedited review
gh pr create --title "fix(auth): patch session vulnerability" --label "hotfix"
```

Hotfixes follow the same PR process but may have expedited review.

### Protected Branch Rules

Configure master branch protection:

- [x] Require pull request before merging
- [x] Require status checks to pass (CI)
- [x] Require conversation resolution
- [x] Require linear history (no merge commits)
- [ ] Require signed commits (optional)
- [x] Do not allow bypassing the above settings

**GitHub Settings → Branches → Branch protection rules:**
- Enable "Require linear history" to enforce squash or rebase merges only
