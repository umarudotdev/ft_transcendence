# SuperCluster Game

SuperCluster is a Super Stardust-inspired 3D twin-stick shooter that replaces the traditional 2D Pong game in ft_transcendence.

## Overview

Players control a spaceship on the surface of a spherical planet, shooting enemies that spawn around them. The game features:

- **3D Graphics**: Three.js-powered rendering with a spherical planet
- **Server-Authoritative**: All game logic runs on the server at 60 ticks/s
- **Real-Time Multiplayer**: WebSocket communication for smooth gameplay

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  apps/web/src/lib/supercluster/                   │  │
│  │  - Three.js renderer (planet, ship, projectiles)  │  │
│  │  - Svelte component wrapper                       │  │
│  │  - Input capture (keyboard, mouse)                │  │
│  │  - lil-gui debug controls                         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  packages/supercluster (shared types)             │  │
│  │  - GameState, SphericalPosition, Messages         │  │
│  │  - Engine logic (for client-side prediction)      │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↑↓ WebSocket (60 Hz)            │
└─────────────────────────────────────────────────────────┘
                          ↑↓
┌─────────────────────────────────────────────────────────┐
│                    SERVER (apps/api)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  modules/supercluster/ (TODO)                     │  │
│  │  - Game engine (physics, state management)        │  │
│  │  - Collision detection (angular distance)         │  │
│  │  - Enemy AI and spawning                          │  │
│  │  - WebSocket gateway                              │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  packages/supercluster (shared types)             │  │
│  │  - Reuses same types as client                    │  │
│  │  - Engine logic (authoritative)                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Visual Design

### Planet Structure

The game world consists of three concentric spheres:

| Layer       | Radius | Description                              |
| ----------- | ------ | ---------------------------------------- |
| Game Sphere | 100    | Invisible - where ship and objects move  |
| Force-Field | 95     | Green wireframe grid (protective shield) |
| Planet      | 70     | Solid blue sphere (actual surface)       |

### Movement Paradigm

Instead of moving the ship around the sphere:

- The **ship stays fixed** in the camera view
- The **planet rotates** under the ship based on input
- This simplifies camera logic and creates a natural feel

## Controls

| Input | Action        |
| ----- | ------------- |
| W / ↑ | Move forward  |
| S / ↓ | Move backward |
| A / ← | Move left     |
| D / → | Move right    |
| Mouse | Aim direction |
| Click | Shoot         |

## Coordinate System

Positions use **spherical coordinates**:

```typescript
interface SphericalPosition {
  phi: number;    // Polar angle from Y-axis (0 to π)
  theta: number;  // Azimuthal angle in XZ plane (0 to 2π)
}
```

Collision detection uses **angular distance** (great-circle distance on the sphere).

## WebSocket Protocol

### Client → Server

```typescript
// Movement input
{ type: "input", keys: { forward, backward, left, right } }

// Aim direction
{ type: "aim", angle: number }  // radians

// Shoot
{ type: "shoot" }

// Ready to start
{ type: "ready" }
```

### Server → Client

```typescript
// Game state (60 times/second)
{
  type: "state",
  state: {
    tick: number,
    ship: { position, aimAngle, lives, invincible },
    projectiles: [...],
    enemies: [...],
    score: number,
    wave: number,
    gameStatus: "waiting" | "playing" | "gameOver"
  }
}

// Events
{ type: "countdown", seconds: number }
{ type: "hit", targetId: number, points: number }
{ type: "damage", lives: number }
{ type: "gameOver", finalScore: number, wave: number }
{ type: "wave", waveNumber: number }
```

## Development

### Package Structure

```
packages/supercluster/           # Shared types + engine (client & server)
├── src/
│   ├── index.ts                 # Package exports
│   ├── types.ts                 # Shared types (positions, state, messages)
│   └── engine/                  # TODO: Shared game logic (physics, collision)
│       ├── physics.ts           # Movement, spherical math
│       └── collision.ts         # Angular distance collision
└── package.json

apps/web/src/lib/supercluster/   # Three.js renderer (client-only)
├── index.ts                     # Module exports
├── SuperCluster.svelte          # Svelte wrapper component
├── renderer/
│   ├── GameRenderer.ts          # Main renderer orchestrator
│   ├── Planet.ts                # Planet + force-field meshes
│   └── Ship.ts                  # Player ship mesh
├── shaders/
│   └── forceField.ts            # Force-field fade shader
└── debug/
    └── DebugGui.ts              # lil-gui debug controls
```

### Using the Component

```svelte
<script lang="ts">
  import { SuperCluster } from '$lib/supercluster';
</script>

<SuperCluster
  wsUrl="wss://localhost/api/supercluster/ws?gameId=123"
  debug={true}
/>
```

### Commands

```bash
# Install all dependencies (from monorepo root)
bun install

# Type check shared package
cd packages/supercluster && bun run check

# Type check web app
cd apps/web && bun run check

# Run web app with game
cd apps/web && bun run dev
```

## Roadmap

### Iteration 1: Basic Scene ✓

- [x] Package structure
- [x] Planet renderer (3-layer spheres)
- [x] Ship renderer (triangle on sphere surface)
- [x] Svelte component wrapper
- [x] WebSocket integration
- [x] lil-gui debug controls
- [x] Input handling (keyboard, mouse)

### Iteration 2: Server Game Logic

- [ ] Game engine (physics, state)
- [ ] Collision detection
- [ ] Shooting mechanics
- [ ] WebSocket gateway

### Iteration 3: Enemies & Gameplay

- [ ] Enemy spawning
- [ ] Enemy types (asteroid, chaser, shooter)
- [ ] Wave system
- [ ] Scoring

### Iteration 4: Polish

- [ ] Visual effects (explosions, particles)
- [ ] Sound effects
- [ ] UI overlay (score, lives, wave)
- [ ] Post-processing effects

## Debug Mode

When `debug={true}` is passed to the component, a lil-gui panel appears with controls for:

| Folder        | Controls                                    |
| ------------- | ------------------------------------------- |
| Renderer      | Show Axes, Force Field opacity (front/back) |
| Game Config   | Sphere radii (game, force-field, planet)    |
| Ship Position | Phi, Theta, Aim Angle                       |

## Additional Documentation

- [Workflow](./supercluster/workflow.md) - Detailed iteration steps and progress
- [Notes](./supercluster/notes.md) - Development notes and technical decisions
