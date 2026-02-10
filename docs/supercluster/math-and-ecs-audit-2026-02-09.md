# SuperCluster Math + ECS Audit (2026-02-09)

## Scope Reviewed
- `apps/web/src/lib/supercluster/renderer/*`
- `packages/supercluster/src/*`
- `docs/supercluster/*` (workflow, architecture, concepts)

## Current Architecture Snapshot
- Current implementation is **componentized renderer architecture**, not full ECS yet.
- `GameRenderer` orchestrates loop/input/gameplay decisions.
- `GameStage` owns render modules (`World`, `Ship`, `Projectile`, `Asteroid`) and `CollisionSystem`.
- Data ownership is mostly clear, but simulation and rendering are still coupled on the client.
- Future docs already target split into shared simulation (`packages/supercluster/simulation`) + thin renderer.

## Where You Are vs Where to Go
- You are at a solid **pre-ECS modular stage**.
- Next architecture step should be: extract pure simulation/math systems (`movement`, `collision`, `spawn`) into shared package and make renderer consume state snapshots.
- Keep coordinate-space contract explicit in one place:
  - World space: ship/projectiles/camera
  - Planet-local: asteroids
  - Bridge: world->planet transform in collision pipeline

## Reconciliation with Collision Validation Doc
- This audit and `docs/supercluster/issues/collision_improvements_validation_2026-02-09.md` are aligned and complementary.
- No conflicts were found between the two documents.
- Non-actionable conceptual note ("sphere distance vs Euclidean") is intentionally omitted from findings because current code already uses angular-space dot/cos checks.
- Validation doc mainly clarifies classification:
  - `collision tunneling` = real robustness issue
  - `broad-phase` = performance optimization
  - `size->angular radius mapping` = implemented, but with type-safety gap

## Findings (Ordered by Severity)

### 1) High: Billboard basis can collapse to NaN for some camera/projectile alignments
- File: `apps/web/src/lib/supercluster/renderer/Projectile.ts:274`
- `right = cross(forward, toCamera).normalize()` can be near-zero when vectors are nearly parallel.
- Then `up` also becomes unstable, producing invalid rotation matrices (flicker/disappear/jump).

**Recommended fix**
- Add epsilon guard for cross length.
- Fallback to a stable auxiliary axis not parallel to `forward`, then rebuild orthonormal basis.

### 2) High: Great-circle axis can collapse (NaN propagation risk)
- Files:
  - `apps/web/src/lib/supercluster/renderer/Projectile.ts:233`
  - `apps/web/src/lib/supercluster/renderer/Asteroid.ts:223`
- `axis = cross(position, velocity).normalize()` assumes strictly tangent, non-degenerate velocity.
- If velocity drifts/degenerates, cross length can approach zero and quaternion becomes invalid.

**Recommended fix**
- Guard axis length with epsilon before normalization.
- If too small, skip frame move or regenerate tangent velocity from current position.

### 3) Medium: Asteroid size is not type-safe in renderer and can break collision math
- Files:
  - `apps/web/src/lib/supercluster/renderer/Asteroid.ts:22`
  - `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:154`
- `AsteroidData.size` is `number` instead of `1 | 2 | 3 | 4`.
- Out-of-range size makes `GAMEPLAY_CONST.ASTEROID_DIAM[asteroid.size - 1]` undefined -> `NaN` radii -> silent collision failures.

**Recommended fix**
- Narrow size type to `1 | 2 | 3 | 4` in renderer data model.
- Add runtime clamp/assert as defensive boundary for spawned/broken asteroids.

### 4) Medium: Collision tunneling risk at low FPS / frame spikes
- File: `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:47`
- Collision uses only current-frame position sample (point-in-time overlap test).
- With larger `deltaTime`, fast projectiles can skip thin targets between frames.

**Recommended fix**
- Add swept test (substeps or arc-segment check using previous projectile position).
- Minimal low-risk option: split projectile update/collision into fixed substeps when `deltaTime` exceeds threshold.

### 5) Low: Documentation drift around Bullet vs Projectile and coordinate-space assumptions
- Examples:
  - `docs/supercluster/workflow.md:148`
  - `docs/supercluster/future-architecture.md:62`
- Docs still reference `Bullet.ts` and older assumptions in some sections.
- Current code uses `Projectile.ts` and world-space projectile model.

**Recommended fix**
- Normalize docs naming (`Projectile`) and keep one canonical collision-space diagram.

### 6) Low: Collision broad-phase is missing (performance-only opportunity)
- File: `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts:47`
- Current projectile-asteroid pass is brute-force O(N*M).
- Current narrow-phase math is correct; this is not a correctness bug.

**Recommended fix**
- Add cheap early-reject broad-phase (e.g., conservative angular window / dot threshold) before narrow-phase checks.

## Patch-Ready Snippets (Proposal Only)

### A) Safe basis build for projectile billboard
```ts
const EPS = 1e-8;

const forward = projectile.velocity.clone().normalize();
const toCamera = new THREE.Vector3()
  .subVectors(this.cameraPosition, this._position)
  .normalize();

const right = new THREE.Vector3().crossVectors(forward, toCamera);
if (right.lengthSq() < EPS) {
  const aux = Math.abs(forward.y) < 0.99
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  right.crossVectors(forward, aux);
}
right.normalize();

const up = new THREE.Vector3().crossVectors(right, forward).normalize();
```

### B) Safe axis guard for sphere movement
```ts
const EPS = 1e-8;
const axis = new THREE.Vector3().crossVectors(position, velocity);
if (axis.lengthSq() < EPS) {
  return; // or regenerate velocity tangent
}
axis.normalize();
```

### C) Type-safe asteroid size
```ts
type AsteroidSize = 1 | 2 | 3 | 4;

interface AsteroidData {
  // ...
  size: AsteroidSize;
}
```

## Suggested Next Refactor Step (ECS Direction)
1. Move `moveOnSphere` and angular collision math to `packages/supercluster/src/simulation/*` as pure functions.
2. Keep renderers as pure visual adapters (consume immutable state arrays).
3. Make `GameRenderer` orchestrate only: input -> simulation tick -> visual sync.
4. Later, reuse same simulation on backend authoritative loop.

## Updated Priority Order
1. Add tunneling mitigation (substeps or swept-arc check).
2. Harden movement math against degenerate cross products (axis/billboard basis guards).
3. Make asteroid size type-safe (`1 | 2 | 3 | 4`) and add runtime guard.
4. Add broad-phase only if/when perf profiling justifies it.
5. Clean up docs terminology (`Bullet` -> `Projectile`) for consistency.
