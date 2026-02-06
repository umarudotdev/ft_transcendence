# SuperCluster Variables Audit

This document catalogs all variables, constants, and hard-coded values in the SuperCluster codebase.

**Purpose:** Identify where values are defined, where they should be, and plan refactoring.

**Last Updated:** After constants refactoring (Phase 1-3 complete)

---

## Audit Legend

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| ✅     | Correctly placed                              |
| ⚠️     | Needs refactoring (misplaced or hard-coded)   |
| 🔄     | Mutable during gameplay (power-ups change it) |
| 🔒     | Immutable constant                            |
| ❌     | Remove (no longer needed)                     |

---

## Current File Structure

```
packages/supercluster/src/
├── constants.ts        # GAME_CONST, GAMEPLAY_CONST (shared physics)
├── defaults.ts         # DEFAULT_GAMEPLAY (starting values)
├── types.ts            # Interfaces + legacy configs (needs cleanup)
└── index.ts            # Exports

apps/web/src/lib/supercluster/
├── constants/
│   └── renderer.ts     # RENDERER_CONST (client visual)
├── renderer/
│   ├── GameRenderer.ts # Main renderer
│   ├── Ship.ts         # Ship + aim dot
│   ├── Bullet.ts       # Projectiles
│   ├── Asteroid.ts     # Asteroids
│   ├── Planet.ts       # Planet + force field
│   └── CollisionSystem.ts
└── SuperCluster.svelte
```

---

## 1. Game Physics Constants (GAME_CONST) ✅

**Location:** `packages/supercluster/src/constants.ts`

| Constant               | Value          | Status | Notes                    |
| ---------------------- | -------------- | ------ | ------------------------ |
| `SPHERE_RADIUS`        | `100`          | ✅🔒   | Game sphere radius       |
| `FORCE_FIELD_RADIUS`   | `95`           | ✅🔒   | Visual boundary          |
| `PLANET_RADIUS`        | `70`           | ✅🔒   | Visual planet size       |
| `TICK_RATE`            | `60`           | ✅🔒   | Server ticks per second  |
| `SHIP_SPEED`           | `0.01`         | ✅🔒   | rad/tick                 |
| `SHIP_INITIAL_POS`     | `{0, 0, 1}`    | ✅🔒   | Unit vector              |
| `PROJECTILE_SPEED`     | `0.015`        | ✅🔒   | rad/tick                 |
| `PROJECTILE_LIFETIME`  | `102`          | ✅🔒   | ticks                    |
| `PROJECTILE_SPREAD`    | `PI/18`        | ✅🔒   | 10 degrees               |
| `ASTEROID_SPEED_MIN`   | `0.00167`      | ✅🔒   | rad/tick                 |
| `ASTEROID_SPEED_MAX`   | `0.005`        | ✅🔒   | rad/tick                 |

---

## 2. Gameplay Constants (GAMEPLAY_CONST) ✅

**Location:** `packages/supercluster/src/constants.ts`

| Constant           | Value          | Status | Notes                        |
| ------------------ | -------------- | ------ | ---------------------------- |
| `HIT_DELAY_SEC`    | `0.5`          | ✅🔒   | Delay before asteroid breaks |
| `BULLET_RADIUS`    | `1`            | ✅🔒   | Collision radius             |
| `SHIP_RADIUS`      | `3`            | ✅🔒   | Collision radius             |
| `ASTEROID_PADDING` | `1.3`          | ✅🔒   | Forgiving collision mult     |
| `ASTEROID_DIAM`    | `[2,4,6,8]`    | ✅🔒   | Diameters by size 1-4        |

---

## 3. Gameplay Defaults (DEFAULT_GAMEPLAY) ✅

**Location:** `packages/supercluster/src/defaults.ts`

| Variable           | Value           | Status | Resets On     | Notes                   |
| ------------------ | --------------- | ------ | ------------- | ----------------------- |
| `shipLives`        | `3`             | ✅🔄   | Restart       | Starting lives          |
| `shipInvincible`   | `false`         | ✅🔄   | Restart       | Starting state          |
| `invincibleTimer`  | `2.0`           | ✅🔄   | Death         | Seconds of invincibility|
| `asteroidWave`     | `{12,8,4,2}`    | ✅🔄   | Restart       | Initial wave counts     |

Helper: `createWaveArray()` converts wave config to spawn array.

---

## 4. Renderer Constants (RENDERER_CONST) ✅

**Location:** `apps/web/src/lib/supercluster/constants/renderer.ts`

| Constant               | Value           | Status | Notes                    |
| ---------------------- | --------------- | ------ | ------------------------ |
| `SCENE_BG`             | `0x111122`      | ✅🔒   | Dark blue background     |
| `CAMERA_FOV`           | `60`            | ✅🔒   | Field of view            |
| `CAMERA_NEAR`          | `0.1`           | ✅🔒   | Near clip plane          |
| `CAMERA_FAR`           | `1000`          | ✅🔒   | Far clip plane           |
| `CAMERA_DIST_MULT`     | `2`             | ✅🔒   | Camera distance mult     |
| `AMB_LIGHT_INTENSITY`  | `0.4`           | ✅🔒   | Ambient light            |
| `DIR_LIGHT_INTENSITY`  | `0.8`           | ✅🔒   | Directional light        |
| `DIR_LIGHT_POS`        | `{50,50,100}`   | ✅🔒   | Light position           |
| `FORCE_FIELD_COLOR`    | `0x00ffaa`      | ✅🔒   | Cyan-green               |
| `FORCE_FIELD_OPACITY`  | `0.35`          | ✅🔒   |                          |
| `SHIP_ROTATION_SPEED`  | `10`            | ✅🔒   | Lerp speed               |
| `AIM_DOT_SIZE`         | `1`             | ✅🔒   |                          |
| `AIM_DOT_COLOR`        | `0xffff00`      | ✅🔒   | Yellow                   |
| `AIM_DOT_ORBIT_RADIUS` | `4`             | ✅🔒   |                          |
| `EXPLOSION_RADIUS`     | `8`             | ✅🔒   |                          |
| `EXPLOSION_COLOR`      | `0xff0000`      | ✅🔒   | Red                      |
| `EXPLOSION_OPACITY`    | `0.7`           | ✅🔒   |                          |
| `BULLET_COLOR`         | `0xffaa00`      | ✅🔒   | Orange-yellow            |
| `BULLET_MAX_COUNT`     | `100`           | ✅🔒   | Performance cap          |

---

## 5. Legacy Interfaces (CLEANUP NEEDED)

**Location:** `packages/supercluster/src/types.ts`

These interfaces exist but are partially redundant after refactoring:

### GameConfig (KEEP - GUI controlled)

```typescript
interface GameConfig {
  projectile: {
    lifetime: number;    // GUI: Bullets → Lifetime
    cooldown: number;    // GUI: Bullets → Cooldown
    rayCount: number;    // GUI: Bullets → Ray Count
    spreadAngle: number; // GUI: Bullets → Spread
  };
}
```

**Status:** ✅ Keep - these are the only GUI-controlled gameplay values.

### RendererConfig (REMOVE)

```typescript
interface RendererConfig {
  forceFieldOpacity: number;
  forceFieldBackFade: number;
  shipRotationSpeed: number;
  aimDotSize: number;
  aimDotColor: number;
  aimDotOrbitRadius: number;
}
```

**Status:** ❌ Remove - all values now in `RENDERER_CONST`. No GUI controls these.

### BulletConfig (REMOVE)

```typescript
interface BulletConfig {
  color: number;
  maxBullets: number;
}
```

**Status:** ❌ Remove - all values now in `RENDERER_CONST`.

---

## 6. Remaining Hardcoded Values

### Ship.ts

| Value      | Line | Current      | Status | Notes / Future Location          |
| ---------- | ---- | ------------ | ------ | -------------------------------- |
| Ship color | 29   | `0x888888`   | ⚠️     | `RENDERER_CONST.SHIP_COLOR`      |
| Roughness  | 31   | `0.8`        | ⚠️     | `RENDERER_CONST.SHIP_ROUGHNESS`  |
| Orbit opacity | 78 | `0.3`       | ⚠️     | `RENDERER_CONST.AIM_ORBIT_OPACITY` |
| Ship size  | 91   | `4`          | ⚠️     | `RENDERER_CONST.SHIP_SIZE`       |
| Ship height| 92   | `2`          | ⚠️     | `RENDERER_CONST.SHIP_HEIGHT`     |
| Width mult | 100+ | `0.6`        | ⚠️     | `RENDERER_CONST.SHIP_WIDTH_MULT` |
| Blink rate | 189  | `100`ms      | ⚠️     | `RENDERER_CONST.INVINCIBLE_BLINK_MS` |

**Note:** Ship is currently a simple triangle/wedge. When replacing with a model, most of these become irrelevant except color/material properties.

### Bullet.ts

| Value         | Line | Current | Status | Notes / Future Location              |
| ------------- | ---- | ------- | ------ | ------------------------------------ |
| Bullet radius | 48   | `0.75`  | ⚠️     | `RENDERER_CONST.BULLET_RADIUS`       |
| Emissive int  | 54   | `0.5`   | ⚠️     | `RENDERER_CONST.BULLET_EMISSIVE_INT` |
| Roughness     | 55   | `0.3`   | ⚠️     | `RENDERER_CONST.BULLET_ROUGHNESS`    |
| Metalness     | 56   | `0.7`   | ⚠️     | `RENDERER_CONST.BULLET_METALNESS`    |
| Y scale       | 36   | `2`     | ⚠️     | `RENDERER_CONST.BULLET_STRETCH`      |

### Asteroid.ts

| Value           | Line  | Current    | Status | Notes / Future Location                |
| --------------- | ----- | ---------- | ------ | -------------------------------------- |
| Asteroid color  | 58    | `0x8b7355` | ⚠️     | `RENDERER_CONST.ASTEROID_COLOR`        |
| Roughness       | 59    | `0.9`      | ⚠️     | `RENDERER_CONST.ASTEROID_ROUGHNESS`    |
| Metalness       | 60    | `0.1`      | ⚠️     | `RENDERER_CONST.ASTEROID_METALNESS`    |
| Hit color       | 265   | `0xff0000` | ⚠️     | `RENDERER_CONST.ASTEROID_HIT_COLOR`    |
| Normal color    | 267   | `0xffffff` | ⚠️     | White (neutral for tinting)            |
| Rotation range  | 94-95 | `2` rad/s  | ⚠️     | `RENDERER_CONST.ASTEROID_ROT_SPEED`    |
| Fragment rot    | 335-6 | `3` rad/s  | ⚠️     | `RENDERER_CONST.ASTEROID_FRAG_ROT`     |
| Fragment speed  | 340   | `1.3` mult | ⚠️     | `GAMEPLAY_CONST.ASTEROID_FRAG_SPEED_MULT` |
| SIZE_MULTIPLIERS| 48    | `[2,4,6,8]`| ⚠️     | Duplicates `GAMEPLAY_CONST.ASTEROID_DIAM` |

### GameRenderer.ts

| Value              | Line | Current   | Status | Notes                               |
| ------------------ | ---- | --------- | ------ | ----------------------------------- |
| Pixel ratio cap    | 101  | `2`       | ✅     | Standard performance cap            |
| Mouse sensitivity  | 280  | `0.005`   | ⚠️     | `RENDERER_CONST.MOUSE_SENSITIVITY`  |
| Ship spawn pos     | 314  | `(0,0,1)` | ⚠️     | Should use `GAME_CONST.SHIP_INITIAL_POS` |
| Explosion segments | 381  | `32`      | ✅     | Geometry detail, fine as-is         |
| Light colors       | 209,212 | `0xffffff` | ✅  | Standard white, not configurable    |
| Game over CSS      | 403-450 | Various | ✅     | UI values, better as Svelte component |

### CollisionSystem.ts ✅

**No hardcoded values found.** All values come from `GAME_CONST` and `GAMEPLAY_CONST`.

### Planet.ts ✅

| Value               | Line | Current | Status | Notes                               |
| ------------------- | ---- | ------- | ------ | ----------------------------------- |
| Sphere segments     | 10   | `64`    | ✅     | Local const, geometry detail        |
| Icosphere detail    | 11   | `10`    | ✅     | Local const, force field detail     |

**Note:** These are geometry detail levels (polygon counts). Fine as local constants since they don't affect gameplay and rarely need changing.

---

## 7. Future: Ship Model Replacement

The ship is currently a procedural triangle/wedge defined in `Ship.ts:86-165`.

**When replacing with a 3D model:**

1. Remove `createTriangleGeometry()` method
2. Load GLTF/GLB model instead
3. Keep these constants relevant:
   - `SHIP_COLOR` (if tinting)
   - `SHIP_SIZE` (scale factor)
   - Material properties (if overriding)
4. Ship collision uses `GAMEPLAY_CONST.SHIP_RADIUS` (unchanged)

**Recommended approach:**
```typescript
// In RENDERER_CONST
SHIP_MODEL_PATH: '/models/ship.glb',
SHIP_SCALE: 1.0,
SHIP_COLOR_TINT: null, // or 0x888888 to tint
```

---

## 8. Refactoring Progress

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

### Phase 4: Clean Up Legacy Interfaces (TODO)

- [ ] Remove `RendererConfig` interface from types.ts
- [ ] Remove `BulletConfig` interface from types.ts
- [ ] Remove `DEFAULT_RENDERER_CONFIG`
- [ ] Remove `DEFAULT_BULLET_CONFIG`
- [ ] Update any code still referencing these

### Phase 5: Consolidate Renderer Hardcodes (TODO - Low Priority)

- [ ] Move Ship.ts hardcoded values to `RENDERER_CONST`
- [ ] Move Bullet.ts hardcoded values to `RENDERER_CONST`
- [ ] Move Asteroid.ts hardcoded values to `RENDERER_CONST`
- [ ] Remove duplicate `SIZE_MULTIPLIERS` in Asteroid.ts

**Note:** Phase 5 is low priority - these values work and are all in one place per file. Only consolidate if we add GUI controls for them or need consistency.

---

## 9. Import Reference

```typescript
// Shared (server + client)
import {
  GAME_CONST,
  GAMEPLAY_CONST,
  DEFAULT_GAMEPLAY,
  createWaveArray,
  type GameConfig,
  DEFAULT_CONFIG
} from '@ft/supercluster';

// Client only
import { RENDERER_CONST } from '../constants/renderer';
```
