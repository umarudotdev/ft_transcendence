# SuperCluster - Configuration System

## Overview

SuperCluster uses a layered configuration system with clear separation between **shared gameplay constants** and **client-only visual settings**.

---

## Configuration Layers

### 1. GAME_CONST (Shared - Immutable Physics)

Physics constants that NEVER change during gameplay. Shared between server and client.

**Location:** `packages/supercluster/src/constants.ts`

```typescript
export const GAME_CONST = Object.freeze({
  // Sphere Geometry
  SPHERE_RADIUS: 100,      // Game sphere radius
  FORCE_FIELD_RADIUS: 95,  // Visual boundary
  PLANET_RADIUS: 70,       // Visual planet size

  // Timing
  TICK_RATE: 60,           // Server ticks per second

  // Ship Physics
  SHIP_SPEED: 0.01,        // Angular velocity (rad/tick)
  SHIP_INITIAL_POS: { x: 0, y: 0, z: 1 },

  // Projectile Physics
  PROJECTILE_SPEED: 0.015, // Angular velocity (rad/tick)
  PROJECTILE_LIFETIME: 102, // Ticks before despawn
  PROJECTILE_SPREAD_ANGLE: Math.PI / 18, // 10 degrees

  // Asteroid Physics
  ASTEROID_SPEED_MIN: 0.00167, // Min angular velocity (rad/tick)
  ASTEROID_SPEED_MAX: 0.005,   // Max angular velocity (rad/tick)
});
```

### 2. GAMEPLAY_CONST (Shared - Mechanics)

Gameplay mechanics that affect collision detection and game balance.

**Location:** `packages/supercluster/src/constants.ts`

```typescript
export const GAMEPLAY_CONST = Object.freeze({
  HIT_DELAY_SEC: 0.5,       // Delay before asteroid breaks
  BULLET_RADIUS: 1,         // Collision radius
  SHIP_RADIUS: 3,           // Collision radius
  ASTEROID_PADDING: 1.3,    // Forgiving collision multiplier
  ASTEROID_DIAM: [2, 4, 6, 8] as const, // Diameters by size 1-4
});
```

### 3. DEFAULT_GAMEPLAY (Shared - Starting Values)

Values that reset when the game restarts.

**Location:** `packages/supercluster/src/defaults.ts`

```typescript
export const DEFAULT_GAMEPLAY = Object.freeze({
  shipLives: 3,
  shipInvincible: false,
  invincibleTimer: 2.0,     // Seconds of invincibility after damage
  asteroidWave: { 1: 12, 2: 8, 3: 4, 4: 2 }, // Initial asteroid counts
});
```

### 4. RENDERER_CONST (Client Only - Visuals)

Visual settings that don't affect gameplay.

**Location:** `apps/web/src/lib/supercluster/constants/renderer.ts`

```typescript
export const RENDERER_CONST = Object.freeze({
  // Scene
  SCENE_BG: 0x111122,

  // Camera
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  CAMERA_DIST_MULT: 2,

  // Lighting
  AMB_LIGHT_INTENSITY: 0.4,
  DIR_LIGHT_INTENSITY: 0.8,
  DIR_LIGHT_POS: { x: 50, y: 50, z: 100 },

  // Force Field
  FORCE_FIELD_COLOR: 0x00ffaa,
  FORCE_FIELD_OPACITY: 0.35,

  // Ship & Aim
  SHIP_ROTATION_SPEED: 10,
  AIM_DOT_SIZE: 1,
  AIM_DOT_COLOR: 0xffff00,
  AIM_DOT_ORBIT_RADIUS: 4,

  // Bullet Visuals
  BULLET_COLOR: 0xffaa00,
  BULLET_MAX_COUNT: 100,
  BULLET_RADIUS: 0.75,
  BULLET_STRETCH: 2,
  BULLET_EMISSIVE_INT: 0.5,
  BULLET_ROUGHNESS: 0.3,
  BULLET_METALNESS: 0.7,

  // Asteroid Visuals
  ASTEROID_COLOR: 0x8b7355,
  ASTEROID_HIT_COLOR: 0xff0000,
  ASTEROID_ROUGHNESS: 0.9,
  ASTEROID_METALNESS: 0.1,
  ASTEROID_ROT_SPEED: 2,
  ASTEROID_FRAG_ROT: 3,
  ASTEROID_FRAG_SPEED_MULT: 1.3,

  // Explosion
  EXPLOSION_RADIUS: 8,
  EXPLOSION_COLOR: 0xff0000,
  EXPLOSION_OPACITY: 0.7,
});
```

### 5. SHIP_GEOMETRY (Client Only - Procedural Ship)

Constants for the procedural ship shape. Replace with 3D model loader when ready.

**Location:** `apps/web/src/lib/supercluster/assets/ship-geometry.ts`

```typescript
export const SHIP_GEOMETRY = Object.freeze({
  COLOR: 0x888888,
  ROUGHNESS: 0.8,
  METALNESS: 0,
  SIZE: 4,
  HEIGHT: 2,
  WIDTH_MULT: 0.6,
  AIM_ORBIT_OPACITY: 0.3,
  INVINCIBLE_BLINK_MS: 100,
});
```

---

## Speed Units and Conversion

### Server-Authoritative (rad/tick)

All speeds in GAME_CONST are measured in **radians per tick**:

```typescript
SHIP_SPEED: 0.01,           // 0.01 rad/tick
PROJECTILE_SPEED: 0.015,    // 0.015 rad/tick
ASTEROID_SPEED_MIN: 0.00167, // 0.00167 rad/tick
TICK_RATE: 60,              // Server runs at 60 ticks/sec
```

### Client Conversion (rad/sec)

The client renderer converts tick-based to time-based:

```typescript
// In client rendering code:
const speedRadPerSec = GAME_CONST.SHIP_SPEED * GAME_CONST.TICK_RATE;
// 0.01 rad/tick × 60 ticks/sec = 0.6 rad/sec

const bulletSpeedRadPerSec = GAME_CONST.PROJECTILE_SPEED * GAME_CONST.TICK_RATE;
// 0.015 rad/tick × 60 ticks/sec = 0.9 rad/sec
```

**Why this matters:**

- Server runs at fixed tick rate (deterministic)
- Client renders at variable frame rate (smooth)
- Conversion happens once per frame: `angle = speedRadPerSec × deltaTime`

---

## Import Reference

```typescript
// Shared (server + client)
import {
  GAME_CONST,
  GAMEPLAY_CONST,
  DEFAULT_GAMEPLAY,
  createWaveArray,
} from '@ft/supercluster';

// Client only - renderer constants
import { RENDERER_CONST } from '../constants/renderer';

// Client only - ship geometry
import { SHIP_GEOMETRY } from '../assets/ship-geometry';
```

---

## Architecture Benefits

### Single Source of Truth

All values defined once in their appropriate constant objects:

```typescript
// ❌ Bad: Hardcoded values scattered
const bulletSpeed = 0.015;  // in Bullet.ts
const bulletSpeed = 0.015;  // also in GameRenderer.ts

// ✅ Good: Single source of truth
GAME_CONST.PROJECTILE_SPEED  // Defined once in constants.ts
```

### Clear Separation

| Constant Type    | Purpose            | Affects Gameplay? | Location |
| ---------------- | ------------------ | ----------------- | -------- |
| GAME_CONST       | Physics, collision | Yes               | Shared   |
| GAMEPLAY_CONST   | Game mechanics     | Yes               | Shared   |
| DEFAULT_GAMEPLAY | Starting values    | Yes (resets)      | Shared   |
| RENDERER_CONST   | Visual settings    | No                | Client   |
| SHIP_GEOMETRY    | Ship appearance    | No                | Client   |

### Immutability

All constant objects use `Object.freeze()` to prevent accidental mutation:

```typescript
// This will fail silently or throw in strict mode:
GAME_CONST.SHIP_SPEED = 0.02;  // ❌ Cannot modify frozen object
```

---

## See Also

- [Variables Audit](./variables-audit.md) - Complete list of all constants
- [Concepts: Movement](./concepts/movement.md) - How movement works on a sphere
- [Concepts: Collision](./concepts/collision.md) - How collision detection works
