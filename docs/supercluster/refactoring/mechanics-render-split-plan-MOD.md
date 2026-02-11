# SuperCluster Server-Authority Plan (Canonical)

Date: 2026-02-10  
Scope: game-state ownership, input flow, simulation loop, and renderer boundaries

## Objective
Finish the mechanics/render split so the server is the single source of truth:
- client sends inputs only,
- server runs simulation in ticks,
- client renders authoritative snapshots/events.

## Engineering Contracts (Kept from OG)

These are the non-negotiable rules to keep migration coherent:

1. Shared state remains engine-agnostic
- `packages/supercluster/src/types.ts` is protocol/domain state, not Three.js runtime objects.
- Keep `Vec3`/primitive serializable fields in shared/network state.

2. Unit contract is explicit
- Simulation/server: ticks + rad/tick.
- Renderer: seconds/frame.
- Convert only at boundaries (`deltaTicks = deltaSeconds * TICK_RATE`).

3. Renderer owns visuals, not authority
- Renderer may keep visual cache fields (`rotationX/Y`, local FX state).
- Authoritative gameplay position/direction/timers come from server/shared simulation snapshots.

4. Coordinate convention must be single-source
- Ship/world frame mapping must be defined once and reused.
- Do not rebuild equivalent transforms in multiple formulas without parity checks.

5. Naming stays unambiguous
- Shared collision logic is canonical in package simulation.
- Renderer collision wrapper stays a bridge (`CollisionBridge`) or is removed.

## Current Status

Completed:
- Shared canonical state and simulation primitives exist in package:
  - `Vec3`, `AsteroidState`, `ProjectileState`
  - `simulation/movement.ts`
  - `simulation/asteroid.ts`
  - `simulation/projectile.ts`
  - `simulation/collision.ts`
- Renderer naming cleanup completed (`CollisionBridge`).
- Fixed-step loop added client-side to reduce tunneling while migration is ongoing.

Not completed:
- Ship movement mechanics are still renderer-owned (`updateLocalMovement` in `GameRenderer.ts`).
- Shooting/cooldown authority is still renderer-owned.
- Collision detection/resolution flow still starts from renderer side.
- Server snapshots are consumed for ship/projectile/asteroid sync, but full websocket session-state integration is still pending.
- Server runtime integration is single-instance/minimal and still needs session/websocket wiring.

## Why Inputs Are the Main Missing Piece

Right now inputs are captured client-side and directly mutate local mechanics.
For server authority, inputs must become data, not direct behavior:
- client emits `PlayerInput`/`AimInput`/`ShootInput` with sequence and tick,
- server applies them in simulation tick order,
- client receives authoritative `GameState` + acknowledgements.

Without this, mechanics cannot be truly authoritative even if math functions are shared.

## Target Runtime Architecture

Server tick loop:
1. receive queued inputs
2. apply input reducer to player control state
3. step mechanics in fixed ticks (ship, projectile, asteroid, collisions)
4. produce authoritative `GameState`
5. publish state/events to clients

Client render loop:
1. capture input and send messages to server
2. receive state snapshots/events
3. sync renderer entities from authoritative state
4. run interpolation/FX only (non-authoritative)

## Required Changes Before Full Server Authority

1. Shared input reducer (package)
- Add simulation functions that convert `InputState` + aim/shoot flags into control deltas.
- Keep deterministic and tick-based.

2. Shared ship mechanics (package)
- Move ship movement math out of renderer into shared tick functions.
- Input: ship state + control input + `deltaTicks`.
- Output: next ship state.

3. Shared top-level tick reducer (package/server)
- Create one orchestrator entrypoint, e.g. `stepGameState(state, inputs, deltaTicks)`.
- Order:
  - ship movement
  - shooting spawn
  - projectile/asteroid step
  - collision detect + resolve
  - cleanup/despawn/wave progression

4. Renderer sync APIs
- Add explicit sync methods:
  - `AsteroidRenderer.syncFromStates(...)`
  - `ProjectileRenderer.syncFromStates(...)`
- Stop renderer-side spawn/despawn decisions as authority.

5. Network/state contract completion
- Ensure state messages carry everything renderer needs.
- Keep units explicit:
  - simulation in ticks and rad/tick
  - renderer converts at boundaries only for visual interpolation.

6. Migration safety
- Feature flag: `localAuthority` vs `serverAuthority`.
- Never run both authoritative paths simultaneously.

## Concrete File Mapping (Merged from OG)

This section maps phases to files so implementation remains auditable.

### Shared package (`packages/supercluster/src`)

1. `types.ts`
- Keep canonical engine-agnostic state contracts.
- Avoid renderer-only shape drift in network/domain state.

2. `simulation/input.ts`
- Input reduction and cooldown stepping in deterministic tick form.

3. `simulation/ship.ts`
- Ship movement mechanics in shared tick path.

4. `simulation/projectile.ts`
- Projectile spawn/step/lifetime in shared simulation.

5. `simulation/asteroid.ts`
- Asteroid spawn/step/split in shared simulation.

6. `simulation/collision.ts`
- Shared narrow-phase collision helpers as canonical mechanics logic.

7. `simulation/game.ts`
- Single orchestration entrypoint(s) for authoritative stepping.

### API runtime (`apps/api/src/modules/game`)

8. `game.runtime.service.ts`
- Fixed-tick authoritative loop.
- Input ingestion, validation, sequencing, authoritative state broadcast.

9. `game.controller.ts`
- WebSocket endpoint wiring, client registration/unregistration, runtime routing.

### Client renderer (`apps/web/src/lib/supercluster/renderer`)

10. `GameRenderer.ts`
- In server mode: consume snapshots, do not mutate authoritative mechanics.
- In local fallback mode: keep behavior isolated and explicit.

11. `Asteroid.ts` and `Projectile.ts`
- Sync from authoritative states.
- Keep render-only caches and GPU update logic.

12. `CollisionBridge.ts`
- Optional visual/debug bridge only; not final authority in server mode.

### Client routing/config

13. `apps/web/src/routes/(app)/game/+page.svelte`
- Correct WS URL selection (dev/prod).

14. `apps/web/vite.config.ts`
- `/api` proxy with `ws: true` for dev websocket upgrade.

## New Problems / Edge Cases Identified

1. Partial state sync path
- `GameRenderer.updateState` updates ship but leaves projectile/asteroid TODOs.
- Risk: mixed authoritative/local entities causing desync.

2. Mixed ownership during transition
- `lastState` gate currently controls some movement logic, but collision and object updates still run locally.
- Risk: hidden dual-authority behavior.

3. Renderer-held gameplay timers
- Shoot cooldown and hit/break timing are still client controlled in parts of flow.
- Must move to server/shared reducer.

## Suggested Implementation Order

Phase 1:
- Introduce shared ship simulation + shared input reducer.
Status: Completed (2026-02-10).

Phase 2:
- Introduce shared top-level simulation tick function.
- Make server call it first; client keeps local fallback behind flag.
Status: Completed (2026-02-10).
Completed in this phase:
- Added shared orchestrator and canonical entrypoint:
  - `stepLocalPlayerSimulation(...)`
  - `stepGameState(...)`
- Added explicit authority mode (`localAuthority` / `serverAuthority`).
- Disabled parallel local/server mutation paths in renderer simulation loop.
- Added API runtime integration that calls `stepGameState(...)` on fixed server ticks:
  - `apps/api/src/modules/game/game.runtime.service.ts`
  - started from `apps/api/src/index.ts`
Additional note:
- A temporary rollback keeps local movement quaternion-driven in renderer to avoid pole singularity glitches from spherical reconstruction.
Remaining follow-up (next phases):
- Wire runtime input/state to real game sessions + websocket endpoints.
- Re-introduce shared movement application in renderer fallback only after preserving quaternion continuity behavior.

Phase 3:
- Complete client sync for projectile/asteroid from server snapshots.
- Disable local spawn/movement authority.
Status: Completed (2026-02-10).
Completed in this phase:
- Added `AsteroidRenderer.syncFromStates(...)`.
- Added `ProjectileRenderer.syncFromStates(...)`.
- Completed `GameRenderer.updateState(...)` snapshot sync TODOs for asteroid/projectile state.
- Disabled local control paths in server mode (`setInput`, `setAimAngle`, `setMousePressed`, `shoot`).
- Wired renderer authority mode to websocket lifecycle in `SuperCluster.svelte`.

Phase 4:
- Move collision resolution fully server-side (detection+resolution).
- Keep client collision as optional debug visual only, then remove.
Status: Completed (2026-02-10).
Completed in this phase:
- Added shared server collision lifecycle step in package simulation:
  - `stepServerGameState(...)` in `packages/supercluster/src/simulation/game.ts`
  - includes projectile-asteroid hits, asteroid hit timers/splitting, and ship-asteroid collision.
- Wired API runtime to use `stepServerGameState(...)` on fixed ticks.
- Added game websocket endpoint and runtime wiring:
  - `apps/api/src/modules/game/game.controller.ts`
  - runtime now receives `ClientMessage` input and broadcasts authoritative `ServerMessage` state each tick.
- Renderer-side collision resolution remains disabled outside local fallback (`serverAuthority` path).

Phase 5:
- Add interpolation/reconciliation polish (not authority-critical, but UX-critical).

## Definition of Done

- Client only sends inputs and renders server state.
- Server is the only authority for movement, spawn, collisions, score, lives, and game-over.
- Package simulation is reusable by server and test harness.
