# Performance Scaling Notes (Consolidated)

Date: 2026-02-10

Canonical owner for collision scaling backlog:
- `docs/supercluster/refactoring/collision-fix-workflow.md`

## Active Performance Backlog

1. Broad phase before narrow phase
- Keep `dot/cos` narrow phase as source of truth.
- Add cheap prefilter in shared package collision path.

2. Removal complexity in hot loops
- Replace repeated `splice` with swap-remove where ordering is not required.
- Apply in authoritative simulation arrays first (server/package path).

3. Future asteroid-asteroid collisions
- Avoid global pair checks.
- Use spherical partition/cell buckets if enabled.

## Note

Performance work should be done only after authority ownership is stable, to avoid optimizing transitional code paths.

---
