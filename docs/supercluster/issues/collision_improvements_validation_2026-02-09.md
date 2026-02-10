# Collision Improvements Validation (2026-02-09)

## Summary

`docs/supercluster/issues/collision_improvements.md` is directionally correct.

Out of 4 items:

- 1 is conceptual guidance already handled in code.
- 1 is a real gameplay robustness issue.
- 1 is a performance optimization (not correctness).
- 1 is already implemented with a type-safety caveat.

## Item Validation

### 3.1 Distance on sphere != Euclidean distance

Status: Correct concept, not a current bug.

Current implementation already uses angular-space collision via dot/cos threshold:

- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:126`
- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:131`

### 3.2 Projectile tunneling

Status: Real issue.

Current flow is discrete:

- projectile moves once per frame (`apps/web/src/lib/supercluster/renderer/Projectile.ts:200`)
- collision is checked after updates (`apps/web/src/lib/supercluster/renderer/GameRenderer.ts:382`)

During low FPS spikes, fast projectiles can skip small asteroids between samples.

### 3.3 Broad-phase early rejection

Status: Valid optimization, not a correctness bug.

Current collision checks are brute-force O(N\*M):

- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:47`

Adding an early reject stage is useful for scale/perf, but behavior is already mathematically correct.

### 3.4 Asteroid size -> angular radius mapping

Status: Mostly implemented, with one robustness gap.

Angular radius is already derived from shared constants:

- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:152`
- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:161`

Gap: asteroid size is typed as `number`, allowing invalid values that can produce NaN radii:

- `apps/web/src/lib/supercluster/renderer/Asteroid.ts:22`

## Recommended Priority

1. Add tunneling mitigation (substeps or swept-arc check).
2. Make asteroid size type-safe (`1 | 2 | 3 | 4`) and add runtime guard.
3. Add broad-phase if perf budget requires it.
