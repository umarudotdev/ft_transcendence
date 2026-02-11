# Game State Refactoring Plan

This document tracks the refactoring of game state types for server-authoritative gameplay.

**Goal:** Clean separation between shared types (network messages) and client-only types (Three.js rendering).

**Status:** ✅ Phase 1 Complete | ✅ Phase 1.5 Complete | ✅ Phase 2 Complete

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
│  Asteroid.ts           Projectile.ts          Ship.ts                   │
│  ──────────────        ──────────────         ────────                  │
│  AsteroidData          ProjectileData         ShipRenderer              │
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

## Phase 1.5: Extract Input Controller 🔄

**Goal:** Clean separation of input handling from game logic, preparing for server-authoritative gameplay.

### Problem: Input State Duplication

Currently, input state is stored in TWO places:

```
SuperCluster.svelte:
  const inputState: InputState = { ... };  ← Copy 1
  let aimAngle = 0;                         ← Copy 1
  let mousePressed = false;                 ← Copy 1

GameRenderer.ts:
  private currentInput: InputState = { ... };  ← Copy 2 (DUPLICATE!)
  private shipAimAngle = 0;                     ← Copy 2 (DUPLICATE!)
  private mousePressed = false;                 ← Copy 2 (DUPLICATE!)
```

This causes confusion about the source of truth and makes the code harder to follow.

### Solution: InputController Class

Create a single source of truth for input state:

```typescript
// apps/web/src/lib/supercluster/renderer/InputController.ts
import type { InputState } from "@ft/supercluster";

export class InputController {
  // Uses existing InputState from shared package - NO new types needed!
  private _keys: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };
  private _aimAngle = 0;
  private _firePressed = false;

  // Setters (called from Svelte via GameRenderer)
  setKeys(keys: InputState): void { this._keys = { ...keys }; }
  setAimAngle(angle: number): void { this._aimAngle = angle; }
  setFirePressed(pressed: boolean): void { this._firePressed = pressed; }

  // Getters (used by mechanics in GameRenderer)
  get keys(): InputState { return this._keys; }
  get aimAngle(): number { return this._aimAngle; }
  get firePressed(): boolean { return this._firePressed; }
  get hasMovementInput(): boolean {
    return this._keys.forward || this._keys.backward ||
           this._keys.left || this._keys.right;
  }

  reset(): void { /* reset all to defaults */ }
}
```

### Input Flow After Refactor

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser DOM (window.addEventListener)                               │
│ Captures: keydown, keyup, mousemove, mousedown, mouseup             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SuperCluster.svelte                                                 │
│ - Processes events → InputState                                     │
│ - Calls renderer.setInput(), setAimAngle(), setFirePressed()        │
│ - Sends to server via WebSocket (serialization)                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ GameRenderer.ts                                                     │
│ - Delegates to InputController (setInput → input.setKeys)           │
│ - Reads from InputController in game loop                           │
│ - Uses for local simulation (until server is ready)                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ InputController (ONE source of truth)                               │
│ - Stores: keys (InputState), aimAngle, firePressed                  │
│ - Used by: updateLocalMovement(), shoot()                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Clarifications

**Ship Angles (two different things):**

| Angle                 | Purpose              | Where it lives  | Sent to server?     |
| --------------------- | -------------------- | --------------- | ------------------- |
| `aimAngle`            | Projectile direction | InputController | ✅ Yes (AimInput)   |
| `targetShipDirection` | Visual ship rotation | GameRenderer    | ❌ No (client-only) |

**Types used:** Existing `InputState` from `packages/supercluster/src/types.ts` - NO new interfaces needed!

**Dead code to remove:** `updateAimFromMouseDelta()` in GameRenderer (unused)

### 1.5.1 Create InputController

**File:** `apps/web/src/lib/supercluster/renderer/InputController.ts`

**Status:** ✅ Complete

### 1.5.2 Update GameRenderer

- Add `private input: InputController`
- Keep public API (`setInput()`, etc.) - delegate to InputController
- Update `updateLocalMovement()` to read from `this.input`
- Update `shoot()` to read from `this.input.aimAngle`
- Remove `currentInput`, `shipAimAngle`, `mousePressed` fields
- Delete unused `updateAimFromMouseDelta()`

**Status:** ✅ Complete

### 1.5.3 Update exports

**File:** `apps/web/src/lib/supercluster/renderer/index.ts`

**Status:** ✅ Complete

---

## Phase 2: Add Three.js to Shared Package ✅

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

**Status:** ✅ Complete

### 2.1 Move simulation logic (FUTURE)

Eventually move physics functions from client to shared:

- `moveOnSphere()` from Asteroid.ts
- `CollisionSystem` class
- Ship movement logic

This enables server to run the same simulation code.

**Status:** ⬜ Future (not blocking)

---

## Phase 3: Move Simulation to Shared Package 🔄

**Goal:** Extract physics and collision logic to shared package so server can run the same code.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHARED PACKAGE                                    │
│               packages/supercluster/src/simulation/                      │
│                                                                          │
│  collision.ts              movement.ts              (future files)       │
│  ─────────────             ────────────             ──────────────       │
│  CollisionResult           moveOnSphere()           spawnAsteroids()     │
│  checkSphereCollision()    sphericalToCartesian()   breakAsteroid()      │
│  getAngularRadius()        cartesianToSpherical()                        │
│                                                                          │
│  Uses: THREE.Vector3, GAME_CONST, GAMEPLAY_CONST                        │
│  NO dependencies on: InstancedMesh, Material, Scene                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Import simulation functions
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT RENDERER                                   │
│               apps/web/src/lib/supercluster/renderer/                    │
│                                                                          │
│  CollisionSystem.ts        Asteroid.ts              Projectile.ts        │
│  ──────────────────        ────────────             ──────────────       │
│  Uses shared collision     Uses shared movement     Uses shared movement │
│  + transforms positions    + manages meshes         + manages meshes     │
│  from renderer types                                                     │
│                                                                          │
│  Keeps: InstancedMesh, Materials, Three.js rendering                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Create Shared Collision Module ✅

**File:** `packages/supercluster/src/simulation/collision.ts`

Pure collision detection using angular distance on sphere surface.

```typescript
import * as THREE from "three";
import { GAME_CONST, GAMEPLAY_CONST, getAsteroidCollisionRadius } from "../constants";

export interface CollisionResult {
  collides: boolean;
  angularDistance: number;  // For debugging/visualization
}

/**
 * Check if two positions on a sphere surface are colliding
 * @param pos1 - First position as unit vector
 * @param pos2 - Second position as unit vector
 * @param radius1 - Angular radius of first object (radians)
 * @param radius2 - Angular radius of second object (radians)
 */
export function checkSphereCollision(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  radius1: number,
  radius2: number
): CollisionResult {
  const dot = pos1.dot(pos2);
  const threshold = Math.cos(radius1 + radius2);
  return {
    collides: dot > threshold,
    angularDistance: Math.acos(Math.max(-1, Math.min(1, dot))),
  };
}

/**
 * Get angular radius for a projectile
 */
export function getProjectileAngularRadius(): number {
  return GAMEPLAY_CONST.PROJECTILE_RADIUS / GAME_CONST.SPHERE_RADIUS;
}

/**
 * Get angular radius for ship
 */
export function getShipAngularRadius(): number {
  return GAMEPLAY_CONST.SHIP_RADIUS / GAME_CONST.SPHERE_RADIUS;
}

/**
 * Get angular radius for asteroid (with collision padding)
 */
export function getAsteroidAngularRadius(size: 1 | 2 | 3 | 4): number {
  return getAsteroidCollisionRadius(size) / GAME_CONST.SPHERE_RADIUS;
}
```

**Status:** ⬜ Not started

### 3.2 Create Shared Movement Module ✅

**File:** `packages/supercluster/src/simulation/movement.ts`

Great-circle motion on sphere surface.

```typescript
import * as THREE from "three";

const EPS = 1e-8;

/**
 * Move a position along sphere surface in a direction
 * @param position - Current position (unit vector, MUTATED)
 * @param velocity - Movement direction (unit vector tangent to sphere, MUTATED)
 * @param angle - Angular distance to move (radians)
 */
export function moveOnSphere(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  angle: number
): void {
  if (angle === 0) return;

  // Reproject velocity onto tangent plane
  const tangentVelocity = velocity
    .clone()
    .sub(position.clone().multiplyScalar(velocity.dot(position)));

  if (tangentVelocity.lengthSq() < EPS) return;
  tangentVelocity.normalize();

  // Rotation axis = perpendicular to position and velocity
  const axis = new THREE.Vector3().crossVectors(position, tangentVelocity);
  if (axis.lengthSq() < EPS) return;
  axis.normalize();

  // Rotate position and velocity
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  position.applyQuaternion(quat).normalize();
  tangentVelocity.applyQuaternion(quat).normalize();
  velocity.copy(tangentVelocity);
}

/**
 * Convert spherical coordinates to Cartesian unit vector
 */
export function sphericalToCartesian(phi: number, theta: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.cos(theta)
  );
}

/**
 * Convert Cartesian unit vector to spherical coordinates
 */
export function cartesianToSpherical(v: THREE.Vector3): { phi: number; theta: number } {
  const phi = Math.acos(Math.max(-1, Math.min(1, v.y)));
  const theta = Math.atan2(v.x, v.z);
  return { phi, theta: theta < 0 ? theta + 2 * Math.PI : theta };
}
```

**Status:** ✅ Complete

### 3.3 Update Shared Package Exports ✅

**File:** `packages/supercluster/src/index.ts`

```typescript
// Simulation (physics, collision, movement - shared between server and client)
export * from "./simulation";
```

**Status:** ✅ Complete

### 3.4 Update Client CollisionSystem ✅

Refactor `apps/web/src/lib/supercluster/renderer/CollisionSystem.ts` to use shared functions.

**Status:** ✅ Complete

### 3.5 Update Client Projectile/Asteroid Movement ✅

Update client renderers to use shared `moveOnSphere()` function.

- **Projectile.ts:** Now uses shared `sharedMoveOnSphere()` from `@ft/supercluster`
- **Asteroid.ts:** Keeps local implementation with renderer-specific fallback behavior (random direction when degenerate) - appropriate for autonomous game objects

**Status:** ✅ Complete

---

## Phase 4: Server State Sync (FUTURE) ⬜

This phase happens AFTER we have a server sending state.

### 4.1 When server sends state

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

### Phase 1.5: Extract Input Controller ✅

- [x] 1.5.1: Create InputController.ts (uses existing InputState type)
- [x] 1.5.2: Update GameRenderer to use InputController
- [x] 1.5.3: Delete unused updateAimFromMouseDelta()
- [x] 1.5.4: Update index.ts exports

### Phase 2: Add Three.js to Shared ✅

- [x] 2.1: Add `three` as dependency to packages/supercluster

### Phase 3: Move Simulation to Shared 🔄

- [x] 3.1: Create collision.ts in packages/supercluster/src/simulation/
- [x] 3.2: Create movement.ts in packages/supercluster/src/simulation/
- [x] 3.3: Update packages/supercluster/src/index.ts exports
- [x] 3.4: Update client CollisionSystem.ts to use shared functions
- [x] 3.5: Update client Projectile/Asteroid to use shared movement

### Phase 4: Server State Sync (FUTURE)

- [ ] 4.1: Implement server-to-client state sync
- [ ] 4.2: Client reconciliation with server state

### Phase 5: Documentation

- [x] 5.1: Create client-side-prediction.md ✅
- [ ] 5.2: Update variables-audit.md

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
