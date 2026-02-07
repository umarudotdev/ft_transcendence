# Game State Refactoring Plan

This document tracks the refactoring of game state types for server-authoritative gameplay.

**Goal:** Clean separation between shared types (network messages) and client-only types (Three.js rendering).

**Status:** ✅ Phase 1 Complete | 🔄 Phase 2 In Progress

---

## Overview

### Key Insight: Three.js Math Works on Server

Three.js has two parts:

- **Math library** (Vector3, Quaternion, Matrix4) → Works ANYWHERE (Node.js, Bun, browser)
- **WebGL rendering** (Scene, Mesh, Renderer) → Needs browser

We CAN use Three.js math in `packages/supercluster` - it works perfectly on server!

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHARED PACKAGE                                    │
│                   packages/supercluster/src/                             │
│                                                                          │
│  types.ts          constants.ts       defaults.ts       simulation/     │
│  ─────────         ────────────       ───────────       ────────────    │
│  AsteroidState     GAME_CONST         DEFAULT_GAMEPLAY  collision.ts    │
│  ProjectileState   GAMEPLAY_CONST                       movement.ts     │
│  ShipState                                              (future)        │
│  GameState                                                               │
│  ClientMessage                                                           │
│  ServerMessage                                                           │
│                                                                          │
│  ✅ CAN use: THREE.Vector3, Quaternion, Matrix4 (math)                  │
│  ❌ CANNOT use: Scene, Mesh, Renderer, Material (WebGL)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Import shared types + simulation
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT RENDERER                                   │
│               apps/web/src/lib/supercluster/renderer/                    │
│                                                                          │
│  Asteroid.ts           Bullet.ts              Ship.ts                   │
│  ──────────────        ──────────             ────────                  │
│  AsteroidData          BulletData             ShipRenderer              │
│  (+ visual props)      (+ visual props)       (+ visual props)          │
│                                                                          │
│  InstancedMesh, Materials, Scene graph = CLIENT ONLY                    │
│                                                                          │
│  ✅ Has all of Three.js                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### What This Means

| In shared package  | Works? | Example                           |
| ------------------ | ------ | --------------------------------- |
| `THREE.Vector3`    | ✅ Yes | Position, velocity calculations   |
| `THREE.Quaternion` | ✅ Yes | Rotation math                     |
| `THREE.Matrix4`    | ✅ Yes | Transform calculations            |
| `moveOnSphere()`   | ✅ Yes | Existing functions work unchanged |
| `CollisionSystem`  | ✅ Yes | Just move it to shared package    |
| `THREE.Scene`      | ❌ No  | Needs WebGL                       |
| `THREE.Mesh`       | ❌ No  | Needs WebGL                       |
| `InstancedMesh`    | ❌ No  | Needs WebGL                       |

---

## Phase 1: Update Shared Types ✅

**File:** `packages/supercluster/src/types.ts`

### 1.1 Replace EnemyState with AsteroidState

```typescript
// OLD (broken)
export interface EnemyState {
  id: number;
  position: SphericalPosition;
  type: EnemyType;
  health: number;
  velocity: SphericalPosition;  // ❌ Wrong - SphericalPosition is coords, not velocity
}

// NEW (fixed)
export interface AsteroidState {
  id: number;
  position: SphericalPosition;
  direction: number;           // ✅ Movement direction on tangent plane (radians)
  speed: number;               // ✅ Angular speed (rad/tick)
  size: 1 | 2 | 3 | 4;
  health: number;              // Hits remaining (usually 1)
  isHit: boolean;              // Has been hit, waiting to break
}
```

**Status:** ✅ Complete

### 1.2 Update ShipState (add power-ups, invincibility timer)

```typescript
// OLD
export interface ShipState {
  position: SphericalPosition;
  aimAngle: number;
  lives: number;
  invincible: boolean;
}

// NEW
export interface ShipState {
  position: SphericalPosition;
  aimAngle: number;
  lives: number;
  invincible: boolean;
  invincibleTicks: number;     // ✅ ADD: Remaining invincibility (for visual feedback)
  cooldownLevel: number;       // ✅ ADD: 0-4, each = -3 ticks cooldown
  rayCountLevel: number;       // ✅ ADD: 0-4, each = +1 ray
}
```

**Status:** ✅ Complete

### 1.3 Update GameState (asteroids instead of enemies)

```typescript
// OLD
export interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  enemies: EnemyState[];        // ❌ Generic
  score: number;
  wave: number;
  gameStatus: GameStatus;
}

// NEW
export interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  asteroids: AsteroidState[];   // ✅ Specific
  score: number;
  wave: number;
  gameStatus: GameStatus;
}
```

**Status:** ✅ Complete

### 1.4 Update GameStatus (remove paused)

```typescript
// OLD
export type GameStatus = "waiting" | "countdown" | "playing" | "paused" | "gameOver";

// NEW
export type GameStatus = "waiting" | "countdown" | "playing" | "gameOver";
```

**Status:** ✅ Complete

### 1.5 Add sequence numbers for future prediction

```typescript
// Client → Server: add seq to inputs
export interface PlayerInput {
  type: "input";
  seq: number;        // ✅ ADD: Sequence number for reconciliation
  tick: number;       // ✅ ADD: Client tick when input made
  keys: InputState;
}

export interface AimInput {
  type: "aim";
  seq: number;        // ✅ ADD
  angle: number;
}

export interface ShootInput {
  type: "shoot";
  seq: number;        // ✅ ADD
}

// Server → Client: add lastInputSeq
export interface StateMessage {
  type: "state";
  state: GameState;
  lastInputSeq: number;  // ✅ ADD: Last processed input sequence
}
```

**Status:** ⬜ Not started

### 1.6 Clean up legacy interfaces

Remove (now in RENDERER_CONST):

- `RendererConfig` interface
- `DEFAULT_RENDERER_CONFIG`
- `BulletConfig` interface
- `DEFAULT_BULLET_CONFIG`

**Status:** ✅ Complete

---

## Phase 2: Add Three.js to Shared Package 🔄

Since Three.js math works on server, we just need to add it as a dependency.

**File:** `packages/supercluster/package.json`

```json
{
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0"
  }
}
```

**Status:** ⬜ Next step

### 2.1 Move simulation logic (FUTURE)

Eventually move physics functions from client to shared:

- `moveOnSphere()` from Asteroid.ts
- `CollisionSystem` class
- Ship movement logic

This enables server to run the same simulation code.

**Status:** ⬜ Future (not blocking)

---

## Phase 3: Update Client Renderer (FUTURE) ⬜

This phase happens AFTER we have a server sending state. For now, client generates its own state.

### 3.1 When server sends state

Client will need to:

1. Receive `AsteroidState[]` from server
2. Update existing `AsteroidData` objects with new positions
3. Keep visual-only properties (rotation, hitTimer) locally

```typescript
// Future: sync client state from server
function syncFromServer(serverAsteroids: AsteroidState[]) {
  for (const serverAst of serverAsteroids) {
    const clientAst = this.asteroids.find(a => a.id === serverAst.id);
    if (clientAst) {
      // Update position from server
      clientAst.position.set(/* from server */);
      // Keep visual properties local
    }
  }
}
```

**Status:** ⬜ Future (after server exists)

---

## Phase 4: Documentation ⬜

### 4.1 Create client-side-prediction.md

Conceptual doc explaining prediction and reconciliation.

**Status:** ⬜ Not started

### 4.2 Update variables-audit.md

Reflect the new type structure.

**Status:** ⬜ Not started

---

## Checklist

### Phase 1: Update Shared Types ✅

- [x] 1.1: Replace EnemyState with AsteroidState
- [x] 1.2: Update ShipState (add power-ups, invincibility timer)
- [x] 1.3: Update GameState (asteroids instead of enemies)
- [x] 1.4: Update GameStatus (remove paused)
- [x] 1.5: Add sequence numbers to ClientMessage/ServerMessage
- [x] 1.6: Remove legacy interfaces (RendererConfig, BulletConfig, GameConfig)

### Phase 2: Add Three.js to Shared (SOON)

- [ ] 2.1: Add `three` as dependency to packages/supercluster

### Phase 3: Move Simulation to Shared (FUTURE)

- [ ] 3.1: Move CollisionSystem to shared
- [ ] 3.2: Move moveOnSphere functions to shared

### Phase 4: Documentation (DONE)

- [x] 4.1: Create client-side-prediction.md ✅
- [ ] 4.2: Update variables-audit.md

---

## Notes

- Three.js math (Vector3, Quaternion) works on server - no conversion needed
- Client currently generates its own state (no server yet)
- Existing physics code can move to shared package unchanged
- Visual properties (rotation, hitTimer) remain client-side only

---

## Completed Refactoring (Related)

### Renderer Architecture Cleanup

During Phase 1, we also cleaned up the client renderer architecture:

**Constants consolidation:**

- `GAME_CONST` in `packages/supercluster/src/constants.ts` - single source of truth for game mechanics
- `RENDERER_CONST` in `apps/web/src/lib/supercluster/constants/renderer.ts` - visual-only constants

**Renderer refactoring:**

- Extracted `ForceFieldRenderer` from PlanetRenderer with explicit `update(cameraPosition)` method
- Renamed `PlanetRenderer` → `WorldRenderer` (container for planet + force field + asteroids)
- Established pattern: explicit dependencies via `update()` methods, not constructor injection

**Files affected:**

- `apps/web/src/lib/supercluster/renderer/World.ts` (new)
- `apps/web/src/lib/supercluster/renderer/ForceField.ts` (new)
- `apps/web/src/lib/supercluster/renderer/Planet.ts` (deleted)
