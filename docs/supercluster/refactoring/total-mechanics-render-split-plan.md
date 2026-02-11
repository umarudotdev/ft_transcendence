# SuperCluster Total Mechanics/Render Split Plan

Date: 2026-02-11  
Status: Active canonical plan (reordered)

## Objective

Create a true split where:
1. Mechanics are authoritative on server/shared simulation.
2. Renderer is state-driven only (draw/read/interpolate).
3. Production path has no renderer-owned gameplay mutation.
4. Local fallback mechanics is deferred until after the split is clean.

---

## Why This Order

We first remove mixed responsibilities and make renderer short/clear.
Then we lock collision in canonical state space.
Only after that we harden session/input/network policies.

This minimizes moving parts during refactor and reduces hidden dual-authority behavior.

---

## Scope

In scope now:
- strict mechanics/render split
- renderer authority cleanup
- collision ownership cleanup
- final server runtime hardening

Deferred:
- local shared-sim fallback runner
- phase-5 optimization/polish (interpolation/perf fine tuning)

---

## Current Baseline

Already done:
- Shared sim modules exist (`movement`, `ship`, `projectile`, `asteroid`, `collision`, `game`).
- `stepServerGameState(...)` exists and is used by API runtime.
- Renderer can sync snapshots (`syncFromStates(...)`).

Still mixed:
- `GameRenderer` still contains local movement/shoot/collision authority path.
- `CollisionBridge` still participates in gameplay path for local mode.
- Fallback policy still allows behavior switch on WS lifecycle.

---

## Execution Workflow

## Phase A - Guard Rails (keep)
Status: Completed (2026-02-11)

Goal: prevent new mixing while refactor proceeds.

Tasks:
1. Add explicit architecture note in `GameRenderer.ts` (server mode = no gameplay mutation).
2. Mark remaining renderer mechanics blocks with `TODO(authority-cleanup)`.
3. Keep docs checklist enforced (`coding-standards.md`, `variables-audit.md`).

Acceptance:
- Team rule is explicit: no new gameplay logic in renderer classes.

---

## Phase B - Hard Mechanics/Render Split (new main phase)
Status: Completed (2026-02-11)

Goal: renderer stops owning mechanics in active runtime path.

Tasks:
1. Move/disable renderer-owned mechanics execution blocks in `GameRenderer`:
   - `updateLocalMovement(...)`
   - local cooldown mutation authority
   - local shoot spawn authority
   - local collision resolution authority (`checkCollisions(...)` path)
2. Keep input side as transport/control intent only:
   - renderer captures input
   - server/shared simulation decides outcomes
3. Keep authoritative state application centralized:
   - `updateState(...)`
   - `AsteroidRenderer.syncFromStates(...)`
   - `ProjectileRenderer.syncFromStates(...)`
   - ship visuals from authoritative state
4. Keep world/camera/effects/frame loop in renderer only.

Acceptance:
- In production path, renderer mutates no gameplay state.
- Renderer loop is shorter and easier to reason about.

Validation:
- `bun run tsc --noEmit` in `packages/supercluster`
- `bun run tsc --noEmit` in `apps/api`
- frontend checks (`bun run check` in `apps/web`)
- runtime smoke test: movement/shoot/collision outcomes continue through server snapshots.

---

## Phase C - Collision Canonicalization (from old Phase E)

Goal: collision decisions rely only on canonical simulation state space.

Tasks:
1. Keep authoritative collision detect/resolve in shared sim + server runtime.
2. Demote `CollisionBridge` to debug/visual adapter only (or remove from prod path).
3. Ensure no gameplay decision depends on renderer world/local transform pipeline.
4. Keep hit/break lifecycle state-driven (`isHit`, `hitTimerTicks`, split states).

Acceptance:
- Production collisions are state-space authoritative, not render-transform dependent.

---

## Phase D - Runtime and Contract Hardening (last)

Goal: make production server authority robust.

Tasks:
1. Session/player isolation:
   - no single global state for all clients.
   - scoped runtime state per session/player.
2. Input routing model:
   - route by session/player key.
   - deterministic per-tick consume semantics.
3. Network contract hardening:
   - strict message validation
   - malformed/out-of-order handling
   - clear ack semantics (`lastInputSeq`).
4. Fallback behavior policy:
   - production: no silent local-authority continuation on WS close.
   - dev/offline: explicit opt-in mode only.

Acceptance:
- No cross-session bleed.
- No hidden authority switches.
- Server authority behavior is explicit and predictable.

---

## Deferred - Local Shared-Sim Fallback (later)

After split + hardening are stable, add optional local mode as:
- same shared simulation runner,
- same state apply path,
- explicit dev/offline flag.

No custom renderer mechanics branch.

---

## Deferred - Phase 5 Optimization (later)

1. Interpolation tuning and jitter reduction.
2. Optional prediction/reconciliation.
3. Broadphase for scaling asteroid-asteroid checks.
4. Performance micro-optimizations after correctness lock.

---

## Work Breakdown by File

Primary:
- `apps/web/src/lib/supercluster/renderer/GameRenderer.ts`
- `apps/web/src/lib/supercluster/renderer/CollisionBridge.ts`
- `apps/web/src/lib/supercluster/SuperCluster.svelte`
- `apps/api/src/modules/game/game.runtime.service.ts`
- `apps/api/src/modules/game/game.controller.ts`
- `packages/supercluster/src/simulation/game.ts`
- `packages/supercluster/src/types.ts`

Supporting:
- `docs/supercluster/refactoring/mechanics-render-split-plan.md` (superseded note)
- `docs/supercluster/refactoring/collision-fix-workflow.md` (align with new order)

---

## Definition of Done

1. Production gameplay authority is server-only.
2. Renderer in production path performs no gameplay mutation.
3. Collision/hit/break decisions come from authoritative simulation state.
4. Runtime is session-scoped and input-routed correctly.
5. Fallback behavior is explicit policy, not accidental.
6. Docs enforce this model and no duplicated mechanics paths remain.
