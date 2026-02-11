# SuperCluster Collision System Plan (Canonical)

Date: 2026-02-10  
Scope: collision correctness, ownership, and performance path

## Objective
Make collision fully server-authoritative while keeping renderer as a pure visual consumer.

## Current Status

Solved:
- Angular-space collision model (`dot/cos`) is in shared package:
  - `packages/supercluster/src/simulation/collision.ts`
- Asteroid/projectile state vectors and movement are in shared simulation modules.
- Major NaN/degeneracy safeguards and fixed-step mitigation were added in renderer flow.

Still missing for full authority:
- Collision detection still executes from renderer via `apps/web/src/lib/supercluster/renderer/CollisionBridge.ts`.
- Collision resolution (remove projectile, mark asteroid hit, break timing) still happens in `apps/web/src/lib/supercluster/renderer/GameRenderer.ts`.
- No authoritative server event stream for collision outcomes yet.

## Required End State

Server/shared simulation owns:
- `detectCollisions(state) -> events`
- `resolveCollisions(state, events) -> nextState`
- deterministic event order (projectile/asteroid, ship/asteroid)

Client renderer owns only:
- transform authoritative state/events into visuals
- local FX timing and interpolation
- no authoritative collision mutation

## Open Issues and How to Solve

1. Renderer-owned collision detection
- Issue:
  - `CollisionBridge` currently reads renderer objects and runs checks each frame.
- Fix:
  - create shared tick function in package (example: `stepCollisionPhase(gameState)`).
  - feed plain state arrays (`ProjectileState[]`, `AsteroidState[]`, ship state).
  - renderer consumes collision results from state/event payloads.

2. Renderer-owned collision resolution
- Issue:
  - projectile removal and asteroid hit/break logic are applied in renderer.
- Fix:
  - move resolution into shared/server reducer.
  - encode authoritative flags/counters in shared state (already started with `hitTimerTicks`).

3. Missing deterministic ordering contract
- Issue:
  - event ordering is implicit in renderer loops.
- Fix:
  - define explicit order in shared simulation:
    - projectile-asteroid resolution first
    - ship-asteroid resolution second
  - document tie-breaker by IDs for deterministic replay.

4. Performance scaling backlog
- Issue:
  - narrow phase is correct, but brute-force pairs will not scale.
- Fix:
  - add broad phase in package collision module.
  - start with cheap dot-threshold prefilter.
  - later: spherical cell buckets if asteroid-asteroid collisions are enabled.

## New Edge Cases Identified

- World/local transform dependency:
  - collision currently depends on renderer world->planet quaternion transform path.
  - server path should use canonical state space only (no render-space transform dependency).

- Potential double-authority during migration:
  - if both renderer and server apply collision updates, desync will happen.
  - temporary guard needed: one authority at a time behind a feature flag.

## Implementation Phases

Phase A:
- Add shared collision phase API that accepts canonical state and outputs collision events.

Phase B:
- Move collision resolution to shared/server reducer.
- Stop mutating collision outcomes in renderer.

Phase C:
- Keep `CollisionBridge` only as temporary adapter for visual transition, then remove.

Phase D:
- Add broad phase after profiling confirms need.

## Acceptance Criteria

- Renderer does not mutate authoritative collision state.
- Shared/server simulation alone determines hits, breaks, damage, and removals.
- Client only mirrors and visualizes authoritative outcomes.
