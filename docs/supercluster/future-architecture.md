# SuperCluster Future Architecture

This document outlines the planned architecture for separating game logic from rendering, enabling server-authoritative gameplay.

---

## Current vs Future

### Current State

```
GameRenderer.ts = Everything mixed together
├── Rendering (THREE.js)
├── Game logic (collisions, spawning)
├── Input handling
└── State management
```

### Target State

```
packages/supercluster/     → Shared game logic (server + client)
apps/web/.../renderer/     → Client rendering only
apps/api/.../supercluster/ → Server game loop (future)
```

---

## File Structure

### Shared Package (`packages/supercluster/src/`)

```
packages/supercluster/src/
├── constants.ts        # GAME_CONST - physics constants (immutable)
├── defaults.ts         # DEFAULT_GAMEPLAY - starting values (reset on restart)
├── types.ts            # Interfaces only (no values)
│
├── network/            # Server/Client communication
│   ├── ClientInput.ts      # What client sends to server
│   └── GameStateUpdate.ts  # What server sends to client
│
├── simulation/         # Game logic (future - runs on server OR client)
│   ├── GameSimulation.ts   # Main game loop
│   ├── CollisionEngine.ts  # Collision detection (pure math, no THREE.js)
│   └── PhysicsEngine.ts    # Movement calculations
│
└── index.ts            # Re-exports
```

### Client Renderer (`apps/web/src/lib/supercluster/`)

```
apps/web/src/lib/supercluster/
├── constants/
│   ├── renderer.ts     # RENDERER_CONST - visual settings
│   └── collision.ts    # COLLISION_CONST - collision sizes
│
├── renderer/
│   ├── GameRenderer.ts # ONLY rendering (receives GameState, draws it)
│   ├── Ship.ts         # Ship visuals
│   ├── Bullet.ts       # Bullet visuals
│   ├── Asteroid.ts     # Asteroid visuals
│   ├── Planet.ts       # Planet visuals
│   └── CollisionSystem.ts  # Visual collision (uses COLLISION_CONST)
│
├── input/
│   └── InputHandler.ts # Captures WASD, mouse, sends to server
│
└── SuperCluster.svelte # Main component
```

### Server (Future) (`apps/api/src/modules/supercluster/`)

```
apps/api/src/modules/supercluster/
├── supercluster.controller.ts  # WebSocket endpoint
├── supercluster.service.ts     # Game instance manager
├── supercluster.repository.ts  # Save stats to DB
├── supercluster.model.ts       # Validation schemas
│
└── game/
    ├── GameInstance.ts         # One game session
    ├── GameLoop.ts             # 60 tick/s loop
    └── PlayerConnection.ts     # WebSocket per player
```

---

## Data Flow

### Current (Client-Only)

```
[Input] → [GameRenderer] → [Render]
           (all logic here)
```

### Future (Server-Authoritative)

```
CLIENT                          SERVER
┌─────────────────┐            ┌─────────────────┐
│ InputHandler    │            │ GameLoop        │
│ - WASD keys     │───────────▶│ - 60 ticks/sec  │
│ - Mouse/aim     │ ClientInput│ - Physics       │
│ - Fire button   │            │ - Collisions    │
└─────────────────┘            └────────┬────────┘
                                        │
┌─────────────────┐            GameStateUpdate
│ GameRenderer    │◀────────────────────┘
│ - Receives state│
│ - Interpolates  │
│ - Renders only  │
└─────────────────┘
```

---

## Network Messages

### Client → Server: `ClientInput`

Sent every frame (or on change):

```typescript
interface ClientInput {
  // Movement keys
  keys: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
  };

  // Aim direction (radians)
  aimAngle: number;

  // Fire button held
  firing: boolean;

  // Timestamp for lag compensation
  timestamp: number;
}
```

### Server → Client: `GameStateUpdate`

Sent every tick (60/sec):

```typescript
interface GameStateUpdate {
  // Tick number for synchronization
  tick: number;

  // Ship state
  ship: {
    phi: number;
    theta: number;
    aimAngle: number;
    lives: number;
    invincible: boolean;
    invincibleTimer: number;
  };

  // All asteroids
  asteroids: Array<{
    id: number;
    phi: number;
    theta: number;
    size: number;       // 1-4
    isHit: boolean;     // Turning red
    hitTimer: number;   // Time until break
  }>;

  // All bullets
  bullets: Array<{
    id: number;
    phi: number;
    theta: number;
    ownerId: number;    // For multiplayer
  }>;

  // Power-ups on field
  powerUps: Array<{
    id: number;
    phi: number;
    theta: number;
    type: 'cooldown' | 'spread';
  }>;

  // Game status
  score: number;
  wave: number;
  isGameOver: boolean;
}
```

---

## Implementation Phases

### Phase 1: Constants Refactoring (COMPLETE)

- [x] Create `GAME_CONST` in `constants.ts`
- [x] Create `DEFAULT_GAMEPLAY` in `defaults.ts`
- [x] Create `RENDERER_CONST` (client)
- [x] Create `GAMEPLAY_CONST` with collision values (shared - gameplay mechanics!)
- [x] Create placeholder interfaces for network (`ClientInput`, `GameStateUpdate`)

### Phase 2: Update Existing Code (COMPLETE)

- [x] Replace hard-coded values in `GameRenderer.ts`
- [x] Replace hard-coded values in `CollisionSystem.ts`
- [x] Clean up `types.ts` (remove moved values)
- [x] Remove `showAxes`, `showDebugInfo`

### Phase 3: Separate Game Logic (Future)

- [ ] Extract collision math to `CollisionEngine.ts`
- [ ] Extract physics to `PhysicsEngine.ts`
- [ ] Create `GameSimulation.ts` that uses them
- [ ] Make `GameRenderer` receive `GameState` only

### Phase 4: Server Implementation (Future)

- [ ] Create WebSocket endpoint
- [ ] Implement `GameLoop.ts` (60 tick/s)
- [ ] Implement `GameInstance.ts`
- [ ] Connect client to server
- [ ] Add interpolation for smooth rendering

### Phase 5: Multiplayer (Future)

- [ ] Multiple players per game
- [ ] Player spawn positions
- [ ] Bullet ownership
- [ ] Score per player
- [ ] Lag compensation

---

## Design Decisions

### Why Server-Authoritative?

1. **Anti-cheat:** Client can't fake scores or god-mode
2. **Consistent physics:** All players see same game state
3. **Fair multiplayer:** No client-side prediction advantages

### Why Separate Constants?

1. **Single source of truth:** Change in one place
2. **Clear categorization:** Know what can/can't change
3. **Server/client split:** Physics shared, visuals client-only

### Why Placeholder Interfaces Now?

1. **Plan ahead:** Know what data we'll need
2. **Guide refactoring:** Keep these structures in mind
3. **Easy transition:** When server comes, just implement
