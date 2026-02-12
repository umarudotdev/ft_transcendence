# SuperCluster Server-Authority Complete Plan

Date: 2026-02-12  
Scope: merge and replace fragmented transition plans with one execution workflow

## Objective

Reach a clean, production-safe server-authoritative architecture where:
1. Server/shared simulation is the only gameplay authority.
2. Client sends intent only (`ready`, `input`, `aim`, `shoot`).
3. Renderer consumes authoritative snapshots/events only.
4. Local mechanics path is removed from production flow.

This plan merges and normalizes:
- `mechanics-render-split-plan-MOD.md`
- `total-mechanics-render-split-plan.md`
- `salvage-checkpoint-from-d45ac74.md`

## What Is Already Solid (Keep And Protect)

1. WS transport foundation
- Dev/prod WS URL wiring from game page.
- Vite proxy with websocket upgrade (`ws: true`).
- Server WS controller/runtime path wired and receiving typed inputs.

2. Lifecycle reconnect guard
- Reconnect behavior no longer loops on unmount/destroy.

3. Shared simulation extraction started
- Ship stepping logic extracted into shared package and used by runtime.

4. Canonical orientation fix for ship/world movement
- Quaternion authority prevented prior mixed-direction instability caused by reconstructing orientation from partial data.

These are guard-railed. Do not rework transport and movement core in the same commit.

## Non-Negotiable Directives

1. Single authority
- No gameplay mutation in renderer while authoritative snapshots exist.

2. Single frame contract
- Movement authority uses vector/quaternion canonical state.
- No alternate spherical reconstruction in authority path.

3. Single unit contract
- Simulation: ticks and rad/tick.
- Renderer: seconds/frame only for visuals.
- Conversion only at boundaries.

4. Shared package stays engine-agnostic in contracts
- No Three.js object types in shared state interfaces.
- Serializable primitives only (`Vec3`, `Quat`, numbers, booleans).

5. Incremental rollout
- Ship first, then projectiles+asteroids, then collisions, then lifecycle/waves.
- Disable unfinished systems during each migration checkpoint.

## Canonical State Contract (Target)

1. Ship authoritative fields
- `position: Vec3` (unit vector on sphere)
- `orientation: Quat`
- `aimAngle: number`
- lives/invincible/cooldowns

2. Projectile authoritative fields
- `id`, `position: Vec3`, `direction: Vec3`, `age`

3. Asteroid authoritative fields
- `id`, `position: Vec3`, `direction: Vec3`, `angularSpeed`, `size`, `health`, `isHit`, `hitTimer`

4. No spherical authority transport
- Spherical is optional for debug/UI only, never canonical runtime state.

## Migration Strategy (Disable During Shift)

During each phase, unfinished mechanics must be explicitly disabled instead of half-running in mixed ownership.

Suggested runtime flags (code or config):
- `AUTH_SHIP=true`
- `AUTH_PROJECTILES=false`
- `AUTH_COLLISIONS=false`
- `AUTH_WAVES=false`
- `ALLOW_LOCAL_FALLBACK=false` (production default)

Behavior:
1. If `AUTH_PROJECTILES=false`, client does not perform authoritative projectile spawn/step in server mode.
2. If `AUTH_COLLISIONS=false`, client collision checks are disabled in server mode.
3. If `AUTH_WAVES=false`, server keeps static/basic wave logic only.

## Execution Phases

## Phase A - Foundation Lock (Transport + Contracts)
Status: Done/Keep Locked

Goals:
1. Preserve working WS path, parser, controller/runtime routing.
2. Preserve reconnect lifecycle guard.
3. Keep message types and input logs explicit.

Validation:
1. Server logs show `ready`, `input`, `aim`, `shoot`.
2. No reconnect storm after page leave.

Rollback trigger:
1. WS connection instability or dropped message categories.

---

## Phase B - Authority Contract Cleanup (State + Naming)
Status: Done/Keep Stable

Goals:
1. Keep ship visual heading local-only (not authoritative state).
2. Remove duplicated initial ship values by using one shared initializer.
3. Keep authoritative ship state minimal and unambiguous.

Key outcomes:
1. `ShipState` no longer carries visual-only heading vector.
2. Shared initializer (`createInitialShipState`) is single source.
3. Naming clarity:
- heading is renderer-local visual state.
- `aimAngle` is gameplay aim intent.
- `orientation` is authoritative world/surface rotation.

Validation:
1. Type checks pass in `packages`, `apps/api`, `apps/web`.
2. Ship movement no longer depends on reconstructing heading from server vector signs.

Rollback trigger:
1. Any reintroduction of duplicated init literals or mixed direction conventions.

---

## Phase C - Ship-Only Authority Checkpoint
Status: Done, keep as baseline

Goals:
1. Server ticks ship movement from input.
2. Client applies ship snapshot only in server mode.
3. Renderer keeps only visual lerp/mesh orientation responsibilities.

Validation:
1. Hold `W`, `A`, `S`, `D` and mixed diagonals for 30s without axis drift.
2. Pole crossing does not explode orientation.
3. Debug overlay confirms mechanics controller is server when snapshots present.

Rollback trigger:
1. Mixed-direction instability returns.

---

## Phase D - Projectile + Asteroid Authority Migration
Status: Next

Goals:
1. Move projectile and asteroid spawn/step/lifecycle authority to server/shared sim.
2. Renderer `shoot()` and local asteroid spawn/update become non-authoritative in server mode.
3. Renderer only `syncFromStates(...)` for projectile/asteroid instances.

Steps:
1. Shared simulation:
- finalize projectile and asteroid reducers in package.
2. Runtime:
- apply shoot input in tick loop and create projectile states.
- advance projectile and asteroid states server-side each tick.
3. Renderer:
- disable local projectile/asteroid spawn/update in server mode.
- read-only sync from server projectile/asteroid lists.

Temporary disable:
1. Collision disabled in this phase to isolate projectile correctness.

Validation:
1. Firing rate matches server cooldown.
2. Projectile origin/heading matches server ship orientation and aim.
3. Asteroids move consistently from authoritative snapshots.
4. No duplicate local + server projectile/asteroid entities.

Failure modes:
1. Double spawn due to local path not fully gated.
2. Tick/second conversion drift in lifetime.
3. Spawn frame mismatch from stale aim sequencing.
4. Mixed reference frame between asteroid world/planet transforms during migration.

---

## Phase E - Collision Authority Migration
Status: After projectile authority

Goals:
1. Server/shared sim owns collision detect and resolve.
2. Renderer collision becomes debug-only or removed.
3. Hit/break/split events originate from server state transitions.

Steps:
1. Runtime applies shared collision step after movement/projectile updates.
2. Runtime updates asteroid hit timers and split/remove results.
3. Renderer only visualizes authoritative outcomes.

Temporary disable:
1. Optional asteroid-asteroid collision kept off until projectile-asteroid and ship-asteroid are stable.

Validation:
1. Projectile-asteroid hits are deterministic and consistent with server logs/state.
2. Ship death/game-over occurs from server collision only.
3. No client-side collision side effects in server mode.

Failure modes:
1. Render/local transform dependency leaking into gameplay collisions.
2. Duplicate hit resolution from mixed local/server checks.
3. Timer mismatch (`hitTimer` tick handling) across runtime/render.

---

## Phase F - Lifecycle/Wave/Game Flow Authority
Status: After collision authority

Goals:
1. Server owns wave progression, spawn cadence, score, lives, game-over.
2. Client displays status only.

Steps:
1. Server runtime advances wave lifecycle.
2. Server emits status transitions (`waiting`, `countdown`, `playing`, `gameOver`).
3. Client removes residual local decisions for restart/game-over outcomes.

Validation:
1. No local score/lives mutation in renderer.
2. Restart/ready transitions deterministic per server state.

Failure modes:
1. Restart sends ready but stale local state remains rendered.
2. Session leakage if runtime is not session-scoped.

---

## Phase G - Runtime Hardening (Production-Ready)
Status: Final

Goals:
1. Session/player isolation.
2. Input routing/ordering hardening.
3. Network contract hardening.
4. Fallback policy hardening.

Steps:
1. Replace single-global runtime state with session-scoped state.
2. Enforce per-session sequence handling and ordering policy.
3. Define and enforce malformed/out-of-order handling.
4. Production policy:
- no silent switch to local authority on WS close.
- explicit reconnect/ended UX.

Validation:
1. Multi-session isolation test.
2. Input ordering/ack test.
3. Disconnect/reconnect behavior test with no authority flip.

## What Can Go Wrong (Known Pitfalls)

1. Dual-authority leakage
- Local mechanics still executing while snapshots arrive.

2. Convention drift
- Different sign conventions between input mapping, mesh rotation, and runtime logs.

3. Initialization drift
- Reintroducing duplicate default state literals across runtime/network/renderer.

4. Boundary unit drift
- Mixing tick-based and second-based values in same reducer path.

5. Hidden transform dependency
- Using render-space transforms for authoritative collision decisions.

6. Reconnect policy ambiguity
- Auto fallback to local authority creates inconsistent gameplay ownership.

## Test Matrix Per Phase

Run after each phase:
1. `cd packages/supercluster && bun run check`
2. `cd apps/api && bun run tsc --noEmit`
3. `cd apps/web && bun run check`

Runtime smoke tests:
1. Open game page, verify one active session flow.
2. Input logs show all categories.
3. Movement stable under mixed keys.
4. Shoot and hit behavior correct for active phase scope.
5. Disconnect/reconnect follows explicit policy.

## Commit Discipline

1. Do not mix transport + movement + collision in one commit.
2. One phase objective per commit series.
3. Keep rollback easy:
- if a phase fails, revert only latest phase commits, keep prior foundation intact.

## Definition Of Done

1. Server/shared simulation is sole gameplay authority.
2. Renderer does no authoritative mutation in server mode.
3. Inputs are intent-only and fully routed through runtime.
4. Projectile, collision, lifecycle all run server-side.
5. Session isolation and reconnect policy are production-safe.
6. Local fallback, if kept, uses same shared sim runner and is explicit dev/offline mode only.
