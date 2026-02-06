# SuperCluster Coding Standards

This document defines naming conventions, code organization, and patterns for the SuperCluster game module.

---

## Naming Conventions

### Summary Table

| Type              | Convention         | Example                              | Notes                              |
| ----------------- | ------------------ | ------------------------------------ | ---------------------------------- |
| True constants    | `UPPER_SNAKE_CASE` | `SPHERE_RADIUS`, `TICK_RATE`         | Never change, ever                 |
| Interfaces/Types  | `PascalCase`       | `GameConfig`, `ShipState`            | Type definitions                   |
| Classes           | `PascalCase`       | `GameRenderer`, `BulletRenderer`     |                                    |
| Default values    | `UPPER_SNAKE_CASE` | `DEFAULT_GAMEPLAY`, `DEFAULT_SHIP`   | Starting values that reset         |
| Mutable state     | `camelCase`        | `currentCooldown`, `shipLives`       | Changes during gameplay            |
| Private internals | `_camelCase`       | `_tempQuat`, `_pitchAxis`            | Reusable objects (GC optimization) |
| Functions/Methods | `camelCase`        | `updateState()`, `checkCollisions()` |                                    |

### Detailed Rules

#### 1. True Constants (`UPPER_SNAKE_CASE`)

Values that NEVER change during the entire application lifecycle:

```typescript
// ✅ Good - These never change
const SPHERE_RADIUS = 100;
const TICK_RATE = 60;
const WORLD_X_AXIS = new THREE.Vector3(1, 0, 0);

// ❌ Bad - These CAN change (not true constants)
const BULLET_COOLDOWN = 18;  // Can change via power-ups!
```

#### 2. Default Starting Values (`UPPER_SNAKE_CASE` with `DEFAULT_` prefix)

Values that reset when game restarts but may change during gameplay:

```typescript
// ✅ Good - Clear that these are defaults, not current values
const DEFAULT_SHIP_LIVES = 3;
const DEFAULT_PROJECTILE_COOLDOWN = 18;
const DEFAULT_PROJECTILE_RAY_COUNT = 1;

// Usage: Reset to default on restart
this.shipLives = DEFAULT_SHIP_LIVES;
```

#### 3. Runtime Mutable State (`camelCase`)

Values that change during gameplay:

```typescript
// ✅ Good - Clearly mutable state
private shipLives = DEFAULT_SHIP_LIVES;
private currentCooldown = 0;
private isGameOver = false;
```

#### 4. Private Reusable Objects (`_camelCase`)

Objects created once and reused to avoid garbage collection:

```typescript
// ✅ Good - Underscore prefix signals "internal, don't touch"
private readonly _tempQuat = new THREE.Quaternion();
private readonly _pitchAxis = new THREE.Vector3(1, 0, 0);
private readonly _yawAxis = new THREE.Vector3(0, 1, 0);
```

---

## Variable Categories

### Category 1: Game Constants (Immutable)

**Location:** `packages/supercluster/src/constants.ts`

These define the game's fundamental physics and never change:

```typescript
export const GAME_CONSTANTS = Object.freeze({
  // Sphere geometry
  SPHERE_RADIUS: 100,
  FORCE_FIELD_RADIUS: 95,
  PLANET_RADIUS: 70,

  // Physics
  TICK_RATE: 60,
  SHIP_SPEED: 0.01,           // rad/tick
  PROJECTILE_SPEED: 0.015,    // rad/tick

  // Math constants
  WORLD_X_AXIS: Object.freeze({ x: 1, y: 0, z: 0 }),
  WORLD_Y_AXIS: Object.freeze({ x: 0, y: 1, z: 0 }),
  SHIP_INITIAL_POSITION: Object.freeze({ x: 0, y: 0, z: 1 }),
});
```

### Category 2: Gameplay Defaults (Reset on Game Start)

**Location:** `packages/supercluster/src/defaults.ts`

Starting values that reset when player dies or restarts:

```typescript
export const DEFAULT_GAMEPLAY = {
  // Ship
  shipLives: 3,
  shipInvincible: false,

  // Projectile (can change via power-ups)
  projectileCooldown: 18,      // ticks
  projectileRayCount: 1,
  projectileLifetime: 102,     // ticks
  projectileSpreadAngle: Math.PI / 18,

  // Asteroids
  asteroidWave: {
    size1: 12,
    size2: 8,
    size3: 4,
    size4: 2,
  },
};
```

### Category 3: Renderer Constants (Visual Only)

**Location:** `apps/web/src/lib/supercluster/constants/renderer.ts`

Visual settings that don't affect gameplay:

```typescript
export const RENDERER_CONSTANTS = Object.freeze({
  // Scene
  SCENE_BACKGROUND: 0x111122,

  // Camera
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  CAMERA_DISTANCE_MULTIPLIER: 2,

  // Lighting
  AMBIENT_LIGHT_INTENSITY: 0.4,
  DIRECTIONAL_LIGHT_INTENSITY: 0.8,
  DIRECTIONAL_LIGHT_POSITION: Object.freeze({ x: 50, y: 50, z: 100 }),

  // Effects
  EXPLOSION_RADIUS: 8,
  EXPLOSION_COLOR: 0xff0000,
  EXPLOSION_OPACITY: 0.7,
});
```

### Category 4: Runtime State (Changes During Play)

**Location:** Inside classes (e.g., `GameRenderer.ts`)

Current game state that changes every frame:

```typescript
class GameRenderer {
  // Mutable gameplay state
  private shipLives = DEFAULT_GAMEPLAY.shipLives;
  private currentCooldown = 0;
  private isGameOver = false;

  // Mutable visual state
  private planetQuaternion = new THREE.Quaternion();
  private shipPosition = new THREE.Vector3(0, 0, 1);
}
```

---

## Code Organization

### File Structure

```
packages/supercluster/src/
├── constants.ts        # GAME_CONSTANTS (true constants, Object.freeze)
├── defaults.ts         # DEFAULT_GAMEPLAY (reset on restart)
├── types.ts            # Interfaces only (no values)
└── index.ts            # Re-exports

apps/web/src/lib/supercluster/
├── constants/
│   └── renderer.ts     # RENDERER_CONSTANTS (visual only)
├── renderer/
│   ├── GameRenderer.ts # Main renderer (runtime state here)
│   ├── Ship.ts
│   ├── Bullet.ts
│   ├── Asteroid.ts
│   └── ...
└── SuperCluster.svelte # Svelte component
```

### Import Patterns

```typescript
// ✅ Good - Clear what you're importing
import { GAME_CONSTANTS } from "@ft/supercluster";
import { DEFAULT_GAMEPLAY } from "@ft/supercluster";
import { RENDERER_CONSTANTS } from "../constants/renderer";

// Usage is self-documenting
const radius = GAME_CONSTANTS.SPHERE_RADIUS;
this.shipLives = DEFAULT_GAMEPLAY.shipLives;
this.scene.background = new THREE.Color(RENDERER_CONSTANTS.SCENE_BACKGROUND);
```

---

## Spread Operator Rule

### When to Use `{ ...DEFAULT }`

Use spread when you need a **mutable copy**:

```typescript
// ✅ Constructor - Need mutable copy for runtime state
constructor(config: GameConfig = { ...DEFAULT_CONFIG }) {
  this.config = config;  // Can modify without affecting DEFAULT_CONFIG
}

// ✅ Reset - Need fresh copy of defaults
restart() {
  this.gameplay = { ...DEFAULT_GAMEPLAY };
}
```

### When NOT to Use Spread

Don't use spread when just **reading** values:

```typescript
// ✅ Good - Just reading, no copy needed
const radius = GAME_CONSTANTS.SPHERE_RADIUS;
const initialLives = DEFAULT_GAMEPLAY.shipLives;

// ❌ Wasteful - Creating copy just to read
const config = { ...DEFAULT_CONFIG };
const radius = config.gameSphereRadius;  // Unnecessary copy!
```

---

## Comments and Documentation

### Section Headers

Use these comment patterns to organize large files:

```typescript
// ============================================================================
// File-level Section (e.g., class name, module purpose)
// ============================================================================

// ========================================================================
// Subsection (e.g., "Input Handling", "Collision Detection")
// ========================================================================
```

### Magic Numbers

Always extract magic numbers to named constants:

```typescript
// ❌ Bad - What is 0.5?
this.asteroids.markAsHit(asteroidId, 0.5);

// ✅ Good - Self-documenting
const HIT_DELAY_SECONDS = 0.5;
this.asteroids.markAsHit(asteroidId, HIT_DELAY_SECONDS);
```

---

## TypeScript-Specific Patterns

### Readonly for Internal Objects

```typescript
// ✅ Prevents accidental reassignment
private readonly _tempQuat = new THREE.Quaternion();

// Can still modify the object's contents:
this._tempQuat.setFromAxisAngle(axis, angle);  // OK

// But cannot reassign:
this._tempQuat = new THREE.Quaternion();  // ❌ Error!
```

### Object.freeze for True Constants

```typescript
// ✅ Prevents any modification at runtime
export const GAME_CONSTANTS = Object.freeze({
  SPHERE_RADIUS: 100,
  // ...
});

// Attempting to modify throws error (in strict mode)
GAME_CONSTANTS.SPHERE_RADIUS = 200;  // ❌ TypeError!
```

### Type-Only Imports

```typescript
// ✅ Good - Only imports the type, not the value
import type { GameConfig, ShipState } from "@ft/supercluster";

// ✅ Mixed - When you need both types and values
import { DEFAULT_CONFIG, type GameConfig } from "@ft/supercluster";
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAMING QUICK REFERENCE                                              │
├─────────────────────────────────────────────────────────────────────┤
│ SPHERE_RADIUS         → True constant (never changes)               │
│ DEFAULT_SHIP_LIVES    → Starting value (resets on restart)          │
│ shipLives             → Runtime state (changes during play)         │
│ _tempQuat             → Reusable internal object (GC optimization)  │
│ GameRenderer          → Class name                                  │
│ GameConfig            → Interface/Type                              │
│ updateState()         → Method/Function                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ WHEN TO USE { ...DEFAULT }                                          │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Constructor     → Need mutable copy                              │
│ ✅ Reset/Restart   → Need fresh defaults                            │
│ ❌ Just reading    → Direct access is fine                          │
└─────────────────────────────────────────────────────────────────────┘
```
