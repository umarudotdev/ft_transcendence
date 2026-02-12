# SuperCluster Server-Authority Directives And Workflow

Date: 2026-02-11
Scope: authoritative simulation contracts, renderer boundary, ship movement rework path

## Core Directives

1. One source of truth for mechanics
- Server/shared simulation owns gameplay state transitions.
- Client renderer applies snapshots and renders visuals.

2. One source of truth for movement frame
- Canonical ship location is a unit vector on sphere surface (`Vec3`).
- Avoid duplicate transform formulas between local and server paths.
- Prefer direct vector/quaternion mapping for world rotation apply.

3. Unit contract is explicit and stable
- Simulation: ticks, rad/tick.
- Renderer: seconds/frame for visual timing only.
- Convert at boundaries only (`deltaTicks = deltaSeconds * TICK_RATE`) when local fallback is used.

4. Simulation stays data-first
- Simulation should not depend on `GameStage`, `THREE.Group`, or scene graph objects.
- Inputs and outputs are plain serializable state objects.

5. Spherical is optional/debug representation
- Spherical fields should not be authoritative movement transport.
- If spherical is required for temporary compatibility, convert only at output boundary and remove as migration progresses.

## State Contract Recommendation

Use vector-first canonical types for authoritative path:

```ts
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ShipState {
  position: Vec3; // unit vector on sphere
  aimAngle: number;
  lives: number;
  invincible: boolean;
  invincibleTicks: number;
  cooldownLevel: number;
  rayCountLevel: number;
}
```

Same principle for projectile/asteroid:
- `position: Vec3`
- `direction: Vec3` (tangent unit vector)
- speeds/timers in simulation units

## Renderer Boundary Rules

1. `GameRenderer` and `GameStage` are render/application layers.
2. Renderer receives authoritative snapshot and applies it.
3. Renderer-owned state is visual-only (lerp angles, mesh rotation cache, shader timing).
4. In server-authority mode:
- no local authoritative movement mutation,
- no local authoritative collision resolution,
- no local authoritative spawn/despawn decisions.

## Input Flow Rules

1. DOM input source: `SuperCluster.svelte`.
2. Renderer input holder (for local fallback only): `InputController`.
3. Network protocol stays stable:
- `ready`, `input`, `aim`, `shoot` from client
- `state`, `gameOver`, other events from server
4. Server session state gates behavior:
- `connected` (socket open, idle)
- `ready` (armed)
- `playing` (simulation active)
- `ended`

## Why Previous Movement Broke

Root cause pattern:
- Local path used incremental quaternion integration.
- Server apply path reconstructed world rotation from spherical angles.
- Those paths are not mathematically identical under all alignments, causing axis/pole artifacts.

Correction principle:
- Apply server movement from canonical vector state directly.
- Keep one transform chain for world rotation.

## Proposed Workflow (Execution Order)

Phase 0: isolate movement
1. Temporarily mute projectile/collision authority paths while debugging ship movement.
2. Validate only ship/world rotation and aim visuals.

Phase 1: stabilize transport and sessions
1. Keep WS path/proxy/runtime logging stable.
2. Ensure reconnect behavior is lifecycle-safe (already patched).
3. Ensure server receives typed input events reliably.

Phase 2: extract shared ship step
1. Move ship stepping logic from renderer into shared simulation function.
2. Keep function pure data-in/data-out.
3. Preserve current control feel/sign convention while extracting.

Phase 3: server ship-only authority checkpoint
1. Server tick loop updates ship state from input.
2. Server broadcasts authoritative ship state every tick.
3. Client applies ship snapshot only (no local ship authority in server mode).

Phase 4: align world apply math
1. Use direct vector/quaternion apply path in `updateState`.
2. Remove alternate spherical reconstruction path from authoritative apply.
3. Validate full-sphere movement (`W`, `A`, `S`, `D`, pole crossing).

Phase 5: re-enable systems incrementally
1. Re-enable projectile authority path.
2. Re-enable collision authority path.
3. Re-enable wave/lifecycle paths.
4. Validate after each re-enable step.

## Validation Checklist

1. No WS reconnect after leaving game page.
2. API logs show explicit input message categories (`input`, `aim`, `shoot`, `ready`).
3. Ship movement is stable under continuous input and pole crossing.
4. No dual-authority mutation in server mode.
5. Renderer-only visuals still function (ship mesh orientation, force field updates, debug overlay).

## Implementation Guardrails

1. Do not change protocol + movement math + collision in one commit.
2. Keep commits narrow and testable.
3. If movement regresses, rollback only the latest movement patch, not WS/runtime foundation.

