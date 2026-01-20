# @ft/supercluster

Shared types and game engine for the SuperCluster game in ft_transcendence.

## Overview

SuperCluster is a twin-stick shooter played on a spherical planet surface. This package contains **shared code** used by both client and server:

- **Types**: Game state, messages, positions, configuration
- **Engine**: Physics, collision detection, game math (for client-side prediction)

The game uses a **server-authoritative** architecture:
- **Server** (apps/api): Runs authoritative game logic
- **Client** (apps/web): Renders graphics, captures input, runs prediction

## Installation

This package is part of the ft_transcendence monorepo. It's automatically linked via Bun workspaces.

```bash
# From monorepo root
bun install
```

## Usage

### Importing Types

```typescript
import {
  type GameState,
  type GameConfig,
  type SphericalPosition,
  type ClientMessage,
  type ServerMessage,
  DEFAULT_CONFIG,
} from '@ft/supercluster';
```

### Using the Svelte Component (from apps/web)

```svelte
<script lang="ts">
  import { SuperCluster } from '$lib/supercluster';
</script>

<SuperCluster
  wsUrl="wss://localhost/api/supercluster/ws?gameId=123"
  debug={true}
/>
```

### Props (SuperCluster.svelte in apps/web)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wsUrl` | `string` | `''` | WebSocket URL for game server |
| `config` | `GameConfig` | `DEFAULT_CONFIG` | Game configuration |
| `rendererConfig` | `RendererConfig` | `DEFAULT_RENDERER_CONFIG` | Renderer settings |
| `debug` | `boolean` | `false` | Show debug overlay |

## Architecture

```
packages/supercluster/              # This package (shared)
├── src/
│   ├── index.ts                    # Package exports
│   ├── types.ts                    # Shared types (client & server)
│   └── engine/                     # TODO: Shared game logic
│       ├── physics.ts              # Movement calculations
│       └── collision.ts            # Angular distance collision
└── docs/
    └── README.md

apps/web/src/lib/supercluster/      # Three.js renderer (client-only)
├── index.ts                        # Module exports
├── SuperCluster.svelte             # Svelte wrapper component
├── renderer/
│   ├── GameRenderer.ts             # Main renderer orchestrator
│   ├── Planet.ts                   # Planet + force-field meshes
│   └── Ship.ts                     # Player ship mesh
└── shaders/
    └── forceField.ts               # Force-field fade shader
```

## Types

### Game State (Server → Client)

```typescript
interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  enemies: EnemyState[];
  score: number;
  wave: number;
  gameStatus: GameStatus;
}
```

### Player Input (Client → Server)

```typescript
// Movement
{ type: 'input', keys: { forward, backward, left, right } }

// Aiming
{ type: 'aim', angle: number }  // radians

// Shooting
{ type: 'shoot' }

// Ready to start
{ type: 'ready' }
```

### Server Messages

```typescript
// Game state (60 times/second)
{ type: 'state', state: GameState }

// Events
{ type: 'countdown', seconds: number }
{ type: 'hit', targetId: number, points: number }
{ type: 'damage', lives: number }
{ type: 'gameOver', finalScore: number, wave: number }
{ type: 'wave', waveNumber: number }
```

## Coordinate System

The game uses **spherical coordinates** for positions on the planet surface:

- `phi`: Polar angle from Y-axis (0 to π)
- `theta`: Azimuthal angle in XZ plane (0 to 2π)

The planet rotates under the ship (ship appears to move, but actually stays fixed in camera view). This simplifies camera logic.

## Visual Structure

Three concentric spheres:

1. **Game Sphere** (radius: 100) - Invisible, where ship/objects move
2. **Force-Field** (radius: 95) - Green wireframe grid
3. **Planet** (radius: 70) - Solid blue sphere

## Development

```bash
# Install dependencies (from monorepo root)
bun install

# Run type check on this package
cd packages/supercluster && bun run check

# Run type check on web app
cd apps/web && bun run check

# Run web app with game
cd apps/web && bun run dev
```

## Related

- Server game logic: `apps/api/src/modules/supercluster/`
- Three.js renderer: `apps/web/src/lib/supercluster/`
- Game page route: `apps/web/src/routes/(app)/game/`
