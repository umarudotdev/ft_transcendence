# SuperCluster Variables Audit

This document catalogs all variables, constants, and hard-coded values in the SuperCluster codebase.

**Purpose:** Identify where values are defined, where they should be, and plan refactoring.

**Last Updated:** After lil-gui removal and constants consolidation (Phase 1-5 complete)

---

## Audit Legend

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| ✅     | Correctly placed                              |
| ⚠️     | Needs refactoring (misplaced or hard-coded)   |
| 🔄     | Mutable during gameplay (power-ups change it) |
| 🔒     | Immutable constant                            |

---

## Current File Structure

```
packages/supercluster/src/
├── constants.ts        # GAME_CONST, GAMEPLAY_CONST (shared physics)
├── defaults.ts         # DEFAULT_GAMEPLAY (starting values)
├── types.ts            # Interfaces (GameState, ClientMessage, etc.)
└── index.ts            # Exports

apps/web/src/lib/supercluster/
├── assets/
│   └── ship-geometry.ts  # SHIP_GEOMETRY (procedural ship constants)
├── constants/
│   └── renderer.ts       # RENDERER_CONST (client visuals)
├── renderer/
│   ├── GameRenderer.ts   # Main renderer
│   ├── Ship.ts           # Ship + aim dot
│   ├── Projectile.ts         # Projectiles
│   ├── Asteroid.ts       # Asteroids
│   ├── Planet.ts         # Planet + force field
│   └── CollisionSystem.ts
└── SuperCluster.svelte
```

---

## 1. Game Physics Constants (GAME_CONST) ✅

**Location:** `packages/supercluster/src/constants.ts`

| Constant              | Value       | Status | Notes                   |
| --------------------- | ----------- | ------ | ----------------------- |
| `SPHERE_RADIUS`       | `100`       | ✅🔒   | Game sphere radius      |
| `FORCE_FIELD_RADIUS`  | `95`        | ✅🔒   | Visual boundary         |
| `PLANET_RADIUS`       | `70`        | ✅🔒   | Visual planet size      |
| `TICK_RATE`           | `60`        | ✅🔒   | Server ticks per second |
| `SHIP_SPEED`          | `0.01`      | ✅🔒   | rad/tick                |
| `SHIP_INITIAL_POS`    | `{0, 0, 1}` | ✅🔒   | Unit vector             |
| `PROJECTILE_SPEED`    | `0.015`     | ✅🔒   | rad/tick                |
| `PROJECTILE_LIFETIME` | `102`       | ✅🔒   | ticks                   |
| `PROJECTILE_SPREAD`   | `PI/18`     | ✅🔒   | 10 degrees              |
| `ASTEROID_SPEED_MIN`  | `0.00167`   | ✅🔒   | rad/tick                |
| `ASTEROID_SPEED_MAX`  | `0.005`     | ✅🔒   | rad/tick                |

---

## 2. Gameplay Constants (GAMEPLAY_CONST) ✅

**Location:** `packages/supercluster/src/constants.ts`

| Constant           | Value       | Status | Notes                        |
| ------------------ | ----------- | ------ | ---------------------------- |
| `HIT_DELAY_SEC`    | `0.5`       | ✅🔒   | Delay before asteroid breaks |
| `BULLET_RADIUS`    | `1`         | ✅🔒   | Collision radius             |
| `SHIP_RADIUS`      | `3`         | ✅🔒   | Collision radius             |
| `ASTEROID_PADDING` | `1.3`       | ✅🔒   | Forgiving collision mult     |
| `ASTEROID_DIAM`    | `[2,4,6,8]` | ✅🔒   | Diameters by size 1-4        |

---

## 3. Gameplay Defaults (DEFAULT_GAMEPLAY) ✅

**Location:** `packages/supercluster/src/defaults.ts`

| Variable          | Value        | Status | Resets On | Notes                    |
| ----------------- | ------------ | ------ | --------- | ------------------------ |
| `shipLives`       | `3`          | ✅🔄   | Restart   | Starting lives           |
| `shipInvincible`  | `false`      | ✅🔄   | Restart   | Starting state           |
| `invincibleTimer` | `2.0`        | ✅🔄   | Death     | Seconds of invincibility |
| `asteroidWave`    | `{12,8,4,2}` | ✅🔄   | Restart   | Initial wave counts      |

Helper: `createWaveArray()` converts wave config to spawn array.

---

## 4. Renderer Constants (RENDERER_CONST) ✅

**Location:** `apps/web/src/lib/supercluster/constants/renderer.ts`

### Scene & Camera

| Constant           | Value      | Status | Notes                |
| ------------------ | ---------- | ------ | -------------------- |
| `SCENE_BG`         | `0x111122` | ✅🔒   | Dark blue background |
| `CAMERA_FOV`       | `60`       | ✅🔒   | Field of view        |
| `CAMERA_NEAR`      | `0.1`      | ✅🔒   | Near clip plane      |
| `CAMERA_FAR`       | `1000`     | ✅🔒   | Far clip plane       |
| `CAMERA_DIST_MULT` | `2`        | ✅🔒   | Camera distance mult |

### Lighting

| Constant              | Value         | Status | Notes             |
| --------------------- | ------------- | ------ | ----------------- |
| `AMB_LIGHT_INTENSITY` | `0.4`         | ✅🔒   | Ambient light     |
| `DIR_LIGHT_INTENSITY` | `0.8`         | ✅🔒   | Directional light |
| `DIR_LIGHT_POS`       | `{50,50,100}` | ✅🔒   | Light position    |

### Force Field & Planet

| Constant                | Value      | Status | Notes      |
| ----------------------- | ---------- | ------ | ---------- |
| `FORCE_FIELD_COLOR`     | `0x00ffaa` | ✅🔒   | Cyan-green |
| `FORCE_FIELD_OPACITY`   | `0.35`     | ✅🔒   |            |
| `FORCE_FIELD_BACK_FADE` | `0.0`      | ✅🔒   |            |
| `PLANET_COLOR`          | `0x4466aa` | ✅🔒   | Blue-ish   |

### Ship & Aim

| Constant               | Value      | Status | Notes      |
| ---------------------- | ---------- | ------ | ---------- |
| `SHIP_ROTATION_SPEED`  | `10`       | ✅🔒   | Lerp speed |
| `AIM_DOT_SIZE`         | `1`        | ✅🔒   |            |
| `AIM_DOT_COLOR`        | `0xffff00` | ✅🔒   | Yellow     |
| `AIM_DOT_ORBIT_RADIUS` | `4`        | ✅🔒   |            |

### Explosion

| Constant            | Value      | Status | Notes |
| ------------------- | ---------- | ------ | ----- |
| `EXPLOSION_RADIUS`  | `8`        | ✅🔒   |       |
| `EXPLOSION_COLOR`   | `0xff0000` | ✅🔒   | Red   |
| `EXPLOSION_OPACITY` | `0.7`      | ✅🔒   |       |

### Projectile Visuals

| Constant              | Value      | Status | Notes                  |
| --------------------- | ---------- | ------ | ---------------------- |
| `BULLET_COLOR`        | `0xffaa00` | ✅🔒   | Orange-yellow          |
| `BULLET_MAX_COUNT`    | `100`      | ✅🔒   | Performance cap        |
| `BULLET_RADIUS`       | `0.75`     | ✅🔒   | Circle geometry radius |
| `BULLET_STRETCH`      | `2`        | ✅🔒   | Y-scale for ellipse    |
| `BULLET_EMISSIVE_INT` | `0.5`      | ✅🔒   | Glow intensity         |
| `BULLET_ROUGHNESS`    | `0.3`      | ✅🔒   |                        |
| `BULLET_METALNESS`    | `0.7`      | ✅🔒   |                        |

### Asteroid Visuals

| Constant                   | Value      | Status | Notes                     |
| -------------------------- | ---------- | ------ | ------------------------- |
| `ASTEROID_COLOR`           | `0x8b7355` | ✅🔒   | Brownish-gray rock        |
| `ASTEROID_HIT_COLOR`       | `0xff0000` | ✅🔒   | Red when hit              |
| `ASTEROID_ROUGHNESS`       | `0.9`      | ✅🔒   | Very rough                |
| `ASTEROID_METALNESS`       | `0.1`      | ✅🔒   | Slightly metallic         |
| `ASTEROID_ROT_SPEED`       | `2`        | ✅🔒   | Self-rotation (rad/s)     |
| `ASTEROID_FRAG_ROT`        | `3`        | ✅🔒   | Fragment rotation (rad/s) |
| `ASTEROID_FRAG_SPEED_MULT` | `1.3`      | ✅🔒   | Fragments 30% faster      |

---

## 5. Ship Geometry Constants (SHIP_GEOMETRY) ✅

**Location:** `apps/web/src/lib/supercluster/assets/ship-geometry.ts`

Procedural ship shape configuration. Replace with 3D model loader when ready.

| Constant              | Value      | Status | Notes                      |
| --------------------- | ---------- | ------ | -------------------------- |
| `COLOR`               | `0x888888` | ✅🔒   | Grey                       |
| `ROUGHNESS`           | `0.8`      | ✅🔒   | Matte finish               |
| `METALNESS`           | `0`        | ✅🔒   | No metallic                |
| `SIZE`                | `4`        | ✅🔒   | Overall size               |
| `HEIGHT`              | `2`        | ✅🔒   | Raised back height         |
| `WIDTH_MULT`          | `0.6`      | ✅🔒   | Width = SIZE \* WIDTH_MULT |
| `AIM_ORBIT_OPACITY`   | `0.3`      | ✅🔒   | Orbit circle transparency  |
| `INVINCIBLE_BLINK_MS` | `100`      | ✅🔒   | Blink rate (ms)            |

---

## 6. Game Config (REMOVED)

**Status:** ✅ REMOVED - Values consolidated into existing constants

The `GameConfig` interface and `DEFAULT_CONFIG` have been removed. Values now live in:

| Former GameConfig Value  | Now In           | Constant                  |
| ------------------------ | ---------------- | ------------------------- |
| `projectile.lifetime`    | GAME_CONST       | `PROJECTILE_LIFETIME`     |
| `projectile.cooldown`    | DEFAULT_GAMEPLAY | `projectileCooldown`      |
| `projectile.rayCount`    | DEFAULT_GAMEPLAY | `projectileRayCount`      |
| `projectile.spreadAngle` | GAME_CONST       | `PROJECTILE_SPREAD_ANGLE` |

---

## 7. Remaining Local Constants ✅

These values are fine as local constants (geometry detail, not configurable):

### Planet.ts

| Value            | Current | Notes                    |
| ---------------- | ------- | ------------------------ |
| Sphere segments  | `64`    | Geometry detail level    |
| Icosphere detail | `10`    | Force field detail level |

### GameRenderer.ts

| Value              | Current    | Notes                            |
| ------------------ | ---------- | -------------------------------- |
| Pixel ratio cap    | `2`        | Standard performance cap         |
| Explosion segments | `32`       | Geometry detail, fine as-is      |
| Light colors       | `0xffffff` | Standard white, not configurable |

---

## 8. Future: Ship Model Replacement

The ship is currently a procedural triangle/wedge defined in `Ship.ts`.

**When replacing with a 3D model:**

1. Create a model loader in `assets/` directory
2. Load GLTF/GLB model instead of `createTriangleGeometry()`
3. Ship geometry constants (`SHIP_GEOMETRY`) can be replaced with model-specific values
4. Ship collision uses `GAMEPLAY_CONST.SHIP_RADIUS` (unchanged)

---

## 9. Refactoring Progress

### Phase 1: Create Constants Files ✅ COMPLETE

- [x] Create `constants.ts` with `GAME_CONST` and `GAMEPLAY_CONST`
- [x] Create `defaults.ts` with `DEFAULT_GAMEPLAY`
- [x] Create `apps/web/.../constants/renderer.ts`
- [x] Update exports in `index.ts`

### Phase 2: Update GameRenderer ✅ COMPLETE

- [x] Replace hard-coded camera values
- [x] Replace hard-coded lighting values
- [x] Replace hard-coded ship initial position
- [x] Replace hard-coded lives value
- [x] Refactor asteroid spawning with `createWaveArray()`
- [x] Replace explosion values

### Phase 3: Update CollisionSystem ✅ COMPLETE

- [x] Replace hard-coded collision radii
- [x] Replace asteroid size diameters
- [x] Replace collision padding

### Phase 4: Clean Up Legacy Interfaces ✅ COMPLETE

- [x] Remove `RendererConfig` interface from types.ts
- [x] Remove `BulletConfig` interface from types.ts
- [x] Remove `DEFAULT_RENDERER_CONFIG`
- [x] Remove `DEFAULT_BULLET_CONFIG`
- [x] Remove lil-gui dependency and debug folder

### Phase 5: Consolidate Renderer Hardcodes ✅ COMPLETE

- [x] Move Ship.ts hardcoded values to `SHIP_GEOMETRY` (assets/ship-geometry.ts)
- [x] Move Projectile.ts hardcoded values to `RENDERER_CONST`
- [x] Move Asteroid.ts hardcoded values to `RENDERER_CONST`
- [x] Remove duplicate `SIZE_MULTIPLIERS` (now uses `GAMEPLAY_CONST.ASTEROID_DIAM`)
- [x] Remove GUI-only methods from renderers

### Phase 6: Remove GameConfig Duplication ✅ COMPLETE

- [x] Remove `GameConfig` interface from types.ts
- [x] Remove `DEFAULT_CONFIG` constant from types.ts
- [x] Update BulletRenderer to use GAME_CONST and DEFAULT_GAMEPLAY directly
- [x] Update GameRenderer to use DEFAULT_GAMEPLAY.projectileCooldown
- [x] Update SuperCluster.svelte to remove config prop
- [x] Update documentation

---

## 10. Import Reference

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
