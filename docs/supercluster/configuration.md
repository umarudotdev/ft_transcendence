# SuperCluster - Configuration System

## Overview

SuperCluster uses a layered configuration system with clear separation between **server-authoritative gameplay mechanics** and **client-side visual preferences**.

---

## Configuration Types

### GameConfig (Server-Authoritative)

All gameplay mechanics that affect game balance, physics, and collision detection.

```typescript
interface GameConfig {
  // GAME LAYER: Affects gameplay mechanics (ship/bullet/asteroid positions)
  gameSphereRadius: number; // Radius where gameplay happens

  // VISUAL LAYER: Purely cosmetic (doesn't affect gameplay)
  forceFieldRadius: number; // Visual radius of force field (< gameSphereRadius)
  planetRadius: number;     // Visual radius of planet (< forceFieldRadius)

  // GAME MECHANICS: All speeds in rad/tick (server converts)
  shipSpeed: number;        // Angular velocity (rad/tick)

  // Projectile mechanics (nested for organization)
  projectile: {
    speed: number;          // Angular velocity (rad/tick)
    lifetime: number;       // Ticks before despawn
    cooldown: number;       // Ticks between shots
    rayCount: number;       // Number of bullets per shot (1-5)
    spreadAngle: number;    // Angle between rays in radians
  };

  // Asteroid mechanics
  asteroidSpeedMin: number; // Minimum asteroid angular velocity (rad/tick)
  asteroidSpeedMax: number; // Maximum asteroid angular velocity (rad/tick)

  tickRate: number;         // Ticks per second (60)
}
```

**Key Points:**
- All speeds in `rad/tick` (server-authoritative)
- Client converts to `rad/sec` using: `speedRadPerSec = speedRadPerTick × tickRate`
- `tickRate` is the conversion factor (default: 60)

### RendererConfig (Client-Only)

Visual preferences that don't affect gameplay.

```typescript
interface RendererConfig {
  // Force field visual settings
  forceFieldOpacity: number;      // Front face opacity
  forceFieldBackFade: number;     // Back face opacity

  // Debug options
  showAxes: boolean;              // Show XYZ axes
  showDebugInfo: boolean;         // Show debug text

  // Ship visual controls
  shipRotationSpeed: number;      // Lerp speed (0-1, higher = faster)

  // Aim dot visual settings
  aimDotSize: number;             // Radius of the dot
  aimDotColor: number;            // Hex color
  aimDotOrbitRadius: number;      // Distance from ship center
}
```

### BulletConfig (Client-Only)

Visual and performance settings for bullets.

```typescript
interface BulletConfig {
  color: number;      // Hex color (yellow/orange) - visual only
  maxBullets: number; // Max bullets on screen (client performance limit)
}
```

**Important:** All bullet gameplay mechanics (speed, lifetime, cooldown, rayCount, spreadAngle) are in `GameConfig.projectile`, **not** in `BulletConfig`.

---

## Speed Units and Conversion

### Server-Authoritative (rad/tick)

All speeds in GameConfig are measured in **radians per tick**:

```typescript
{
  shipSpeed: 0.01,              // 0.01 rad/tick
  projectile: {
    speed: 0.05,                // 0.05 rad/tick
  },
  asteroidSpeedMin: 0.00167,    // 0.00167 rad/tick
  asteroidSpeedMax: 0.005,      // 0.005 rad/tick
  tickRate: 60,                 // Server runs at 60 ticks/sec
}
```

### Client Conversion (rad/sec)

The client renderer converts tick-based to time-based:

```typescript
// In client rendering code:
const speedRadPerSec = config.shipSpeed * config.tickRate;
// 0.01 rad/tick × 60 ticks/sec = 0.6 rad/sec

const bulletSpeedRadPerSec = config.projectile.speed * config.tickRate;
// 0.05 rad/tick × 60 ticks/sec = 3.0 rad/sec
```

**Why this matters:**
- Server runs at fixed tick rate (deterministic)
- Client renders at variable frame rate (smooth)
- Conversion happens once per frame: `angle = speedRadPerSec × deltaTime`

---

## Default Configuration

```typescript
export const DEFAULT_CONFIG: GameConfig = {
  // Game layer
  gameSphereRadius: 100,      // Game sphere (where ship/bullets/asteroids exist)

  // Visual layer (cosmetic only)
  forceFieldRadius: 95,       // Force field appears inside game sphere
  planetRadius: 70,           // Planet core inside force field

  // Game mechanics (angular speeds in rad/tick)
  shipSpeed: 0.01,            // 0.6 rad/sec at 60 ticks/sec

  // Projectile mechanics
  projectile: {
    speed: 0.05,              // 3.0 rad/sec at 60 ticks/sec
    lifetime: 120,            // 2 seconds at 60 ticks/sec
    cooldown: 12,             // 0.2 seconds at 60 ticks/sec (5 shots/sec)
    rayCount: 1,              // Single shot
    spreadAngle: Math.PI / 18, // 10 degrees
  },

  // Asteroid mechanics
  asteroidSpeedMin: 0.00167,  // ~0.1 rad/sec at 60 ticks/sec
  asteroidSpeedMax: 0.005,    // ~0.3 rad/sec at 60 ticks/sec

  tickRate: 60,
};

export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  forceFieldOpacity: 0.35,
  forceFieldBackFade: 0.0,
  showAxes: false,
  showDebugInfo: false,

  // Ship rotation
  shipRotationSpeed: 10,      // ~0.3s to rotate at 60fps

  // Aim dot
  aimDotSize: 1,
  aimDotColor: 0xffff00,      // Yellow
  aimDotOrbitRadius: 4,       // Slightly larger than ship
};

export const DEFAULT_BULLET_CONFIG: BulletConfig = {
  color: 0xffaa00,            // Orange-yellow
  maxBullets: 100,            // Performance cap for low-end devices
};
```

---

## Configuration Updates

### Gameplay Mechanics (GameConfig)

Updates to gameplay mechanics propagate to all affected systems:

```typescript
// Update projectile mechanics
renderer.updateProjectileConfig({
  rayCount: 3,                // Spread shot
  spreadAngle: Math.PI / 12,  // 15 degrees
});

// This updates:
// - BulletRenderer.spawnSpread() behavior
// - Shooting mechanics in GameRenderer.shoot()
```

### Visual Settings (RendererConfig)

Updates to visual settings affect only appearance:

```typescript
// Update renderer visuals
renderer.updateRendererConfig({
  forceFieldOpacity: 0.5,
  shipRotationSpeed: 15,
});

// This updates:
// - PlanetRenderer material opacity
// - ShipRenderer rotation lerp speed
// - Does NOT affect gameplay
```

### Visual-Only Radii

Some radius updates are purely cosmetic:

```typescript
// Update visual-only radii (doesn't affect gameplay)
renderer.setPlanetRadius(80);       // Bigger planet visual
renderer.setForceFieldRadius(90);   // Smaller force field visual

// Gameplay sphere radius stays at 100
// Ship/bullets/asteroids still collide at radius 100
```

---

## Debug GUI Integration

The Debug GUI reads all initial values from actual config (no hardcoding):

```typescript
constructor(renderer: GameRenderer, container?: HTMLElement) {
  // Initialize ALL state from actual config (single source of truth)
  const config = this.renderer.getConfig();
  const rendererConfig = this.renderer.getRendererConfig();
  const bulletConfig = this.renderer.getBulletConfig();

  // Projectile mechanics from GameConfig (convert ticks → seconds for GUI)
  this.state.bulletLifetime = config.projectile.lifetime / config.tickRate;
  this.state.bulletCooldown = config.projectile.cooldown / config.tickRate;
  this.state.bulletRayCount = config.projectile.rayCount;
  this.state.bulletSpreadAngle = (config.projectile.spreadAngle * 180) / Math.PI;

  // Visual config from BulletConfig
  this.state.bulletColor = `#${bulletConfig.color.toString(16).padStart(6, "0")}`;
}
```

**Unit Conversions in GUI:**
- Display: seconds, degrees (user-friendly)
- Storage: ticks, radians (game-friendly)
- Conversion happens in `onChange` handlers

---

## Architecture Benefits

### Single Source of Truth

**Problem:** Hardcoded values scattered across codebase
**Solution:** All values defined once in config objects

```typescript
// ❌ Bad: Hardcoded values
const bulletSpeed = 0.05;  // Defined in Bullet.ts
const bulletSpeed = 0.05;  // Also defined in GameRenderer.ts
const bulletSpeed = 0.05;  // Also defined in DebugGui.ts

// ✅ Good: Single source of truth
config.projectile.speed     // Defined once in types.ts
```

### Clear Separation

**Problem:** Mixed gameplay and visual settings
**Solution:** Separate config objects for different concerns

| Config Type      | Purpose                  | Affects Gameplay? |
|------------------|--------------------------|-------------------|
| GameConfig       | Physics, collision, AI   | Yes               |
| RendererConfig   | Visual preferences       | No                |
| BulletConfig     | Bullet appearance, caps  | No (visual only)  |

### Server-Client Consistency

**Problem:** Client and server use different values
**Solution:** Shared GameConfig package

```typescript
// packages/supercluster/src/types.ts
export interface GameConfig { ... }

// Both import same types:
import { GameConfig } from "@ft/supercluster";  // Client
import { GameConfig } from "@ft/supercluster";  // Server
```

---

## Common Patterns

### Reading Config

```typescript
// Get current config (returns copy to prevent mutation)
const config = renderer.getConfig();
const rendererConfig = renderer.getRendererConfig();
const bulletConfig = renderer.getBulletConfig();
```

### Updating Config

```typescript
// Update entire config
renderer.updateConfig(newGameConfig);

// Update specific projectile settings
renderer.updateProjectileConfig({
  rayCount: 5,
  spreadAngle: Math.PI / 6,
});

// Update visual settings
renderer.setBulletColor(0xff0000);  // Red bullets
renderer.setForceFieldOpacity(0.5, 0.2);
```

### Converting Units

```typescript
// Ticks → Seconds
const lifetimeSeconds = config.projectile.lifetime / config.tickRate;

// Seconds → Ticks
const lifetimeTicks = lifetimeSeconds * config.tickRate;

// Radians → Degrees
const spreadDegrees = (config.projectile.spreadAngle * 180) / Math.PI;

// Degrees → Radians
const spreadRadians = (spreadDegrees * Math.PI) / 180;
```

---

## Migration Notes

### From Old to New Structure

**Old structure (before refactoring):**
```typescript
// Bullet mechanics scattered across multiple configs
GameConfig {
  projectileSpeed: 0.05,
  projectileLifetime: 120,
  projectileCooldown: 12,
}

BulletConfig {
  rayCount: 1,          // ❌ Affects gameplay
  spreadAngle: 0.17,    // ❌ Affects gameplay
  color: 0xffaa00,
  maxBullets: 100,
}
```

**New structure (after refactoring):**
```typescript
// All mechanics nested in GameConfig.projectile
GameConfig {
  projectile: {
    speed: 0.05,
    lifetime: 120,
    cooldown: 12,
    rayCount: 1,        // ✅ Gameplay mechanic
    spreadAngle: 0.17,  // ✅ Gameplay mechanic
  },
}

BulletConfig {
  color: 0xffaa00,      // ✅ Visual only
  maxBullets: 100,      // ✅ Performance only
}
```

**Breaking changes:**
- `config.projectileSpeed` → `config.projectile.speed`
- `config.projectileLifetime` → `config.projectile.lifetime`
- `config.projectileCooldown` → `config.projectile.cooldown`
- `bulletConfig.rayCount` → `config.projectile.rayCount`
- `bulletConfig.spreadAngle` → `config.projectile.spreadAngle`

---

## See Also

- [Notes](./notes.md) - Development decisions and architecture
- [Collision System](./collision.md) - How config affects collision detection
- [Networking](./networking.md) - How config is synchronized across clients
