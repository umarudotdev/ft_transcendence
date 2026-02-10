# SuperCluster Collision Fix Workflow

## Goal
Deliver collision/math improvements from `docs/supercluster/math-and-ecs-audit-2026-02-09.md` in a safe order:
- correctness first
- robustness second
- performance third
- docs consistency last

This workflow covers topics 1-6 from the audit.

## Scope
- `apps/web/src/lib/supercluster/renderer/Projectile.ts`
- `apps/web/src/lib/supercluster/renderer/Asteroid.ts`
- `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts`
- `apps/web/src/lib/supercluster/renderer/GameRenderer.ts`
- docs under `docs/supercluster/*` (naming + architecture notes)

## Execution Strategy
- Use small patches by phase.
- Validate after every phase before moving forward.
- Avoid mixing correctness and optimization in one patch.

## Phase 0 - Baseline and Criteria (Completed)
Status: Completed on 2026-02-10.
Reference: `docs/supercluster/refactoring/collision-phase-0-baseline.md`

1. Confirm current behavior and known issues from audit doc.
2. Define "done" checks:
   - no NaN transforms for projectiles/asteroids
   - no invalid asteroid-size collision math path
   - stable hit detection under frame spikes
   - acceptable collision cost at higher object counts

## Phase 1 - Correctness Guards (Topics 1, 2, 3) (Completed)
Status: Completed on 2026-02-10.

### 1.1 Billboard basis guard (Topic 1)
- Add epsilon check when computing `right = forward x toCamera`.
- If degenerate, use fallback auxiliary axis to rebuild orthonormal basis.

Acceptance:
- projectile visuals do not flicker/disappear due to degenerate basis
- no invalid rotation matrices when projectile aligns with camera direction

### 1.2 Great-circle axis guard (Topic 2)
- Before normalizing `axis = position x velocity`, check `axis.lengthSq()`.
- If too small, either:
  - skip movement for that frame, or
  - regenerate/reproject a tangent velocity and continue.
- Keep behavior deterministic and documented.

Acceptance:
- no NaN quaternion path in projectile/asteroid movement
- objects remain on sphere and continue moving stably

### 1.3 Type and runtime guard for asteroid size (Topic 3)
- Narrow `AsteroidData.size` to `1 | 2 | 3 | 4`.
- Add defensive runtime validation at creation/use boundaries.

Acceptance:
- compile-time rejection of invalid size assignments
- runtime avoids NaN collision radius if unexpected size appears

## Phase 2 - Tunneling Mitigation (Topic 4)

### 2.1 Choose first implementation
- Preferred first step: fixed simulation step (or projectile sub-steps).
- Keep it minimal before attempting fully analytic swept-arc collision.

### 2.2 Implement and verify
- Ensure multiple mechanics updates can run for one render frame when `deltaTime` is large.
- Keep rendering decoupled from simulation tick progression.

Acceptance:
- reduced/removed missed hits during low FPS spikes
- stable gameplay feel under fluctuating frame time

## Phase 3 - Performance Scaling (Topic 6)

### 3.1 Add broad-phase prefilter
- Keep narrow-phase unchanged (dot/cos check remains source of truth).
- Add cheap early reject before full narrow-phase test.

### 3.2 Prepare for asteroid-asteroid collisions
- If asteroid-asteroid collisions are enabled, avoid full global pair checks.
- Introduce spatial partitioning on sphere (cell buckets/neighborhood checks).

Acceptance:
- collision pass cost grows slower with object count
- no regression in collision correctness

## Phase 4 - Documentation Cleanup (Topic 5)
1. Replace legacy `Bullet` references with `Projectile` in supercluster docs.
2. Keep one canonical explanation of coordinate spaces and collision flow.
3. Link all related docs to canonical source to prevent drift.

Acceptance:
- naming consistent across docs and code
- no contradictory collision-space descriptions

## Recommended Patch Order
1. Patch A: Topics 1 + 2 + 3 (small and high value)
2. Patch B: Topic 4 (tunneling)
3. Patch C: Topic 6 (broad-phase / scaling)
4. Patch D: Topic 5 (docs consistency pass)

## Risk Control Notes
- Do not combine refactor + behavior change + optimization in the same patch.
- Keep constants centralized in `@ft/supercluster`.
- When introducing guards, prefer explicit comments on fallback behavior.
- If server-authoritative simulation is introduced later, move shared math to `packages/supercluster/src/simulation/*`.

## Optional Test Scenarios (Manual)
1. Aim projectile toward camera and move through alignment edge cases.
2. Force frame spikes and confirm projectile hits remain reliable.
3. Inject invalid asteroid size in a debug-only path and confirm safe handling.
4. Spawn higher object counts and compare collision frame time before/after broad-phase.
