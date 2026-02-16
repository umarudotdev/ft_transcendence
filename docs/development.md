# Development Guide

This guide covers setting up the development environment and implementing
features for the ft_transcendence bullet hell game.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- PostgreSQL 16 (via Docker)

## Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd ft_transcendence

# Start everything with Docker
docker compose up --build

# Or run services individually:
bun install
cd apps/api && bun run migrate
cd apps/game && bun run dev &
bun run dev
```

## Project Structure

```
ft_transcendence/
├── apps/
│   ├── api/           # ElysiaJS - auth, matchmaking, chat, rankings
│   ├── game/          # Colyseus - game rooms, physics, combat
│   └── web/           # SvelteKit - frontend
├── packages/          # Shared types
└── docs/              # Documentation
```

## Architecture Overview

See [Architecture](./architecture.md) for detailed technical documentation.

### Two Backend Services

1. **ElysiaJS (apps/api)** handles:
   - Authentication (42 OAuth, TOTP 2FA)
   - User profiles and friends
   - Matchmaking queue
   - Rankings and Elo
   - Chat system

2. **Colyseus Game Server (apps/game)** handles:
   - Room-based game sessions
   - 60Hz fixed timestep game loop
   - Player movement and physics
   - Bullet spawning and collision
   - Combat (damage, HP, lives)
   - Abilities and cooldowns
   - Automatic state synchronization

### Communication Flow

```
Frontend → ElysiaJS: "Find match"
ElysiaJS → Frontend: "Match found, room ID: abc123"
Frontend → Colyseus: client.joinById("abc123")
Colyseus → Frontend: state patches at 60Hz
Frontend → Colyseus: room.send("input", keys)
Colyseus → ElysiaJS: "Game over, winner is A"
ElysiaJS: Updates Elo ratings
```

---

## ElysiaJS Development

### Vertical Slice Pattern

Each feature module is self-contained:

```
modules/[feature]/
├── [feature].controller.ts   # HTTP routes + TypeBox validation
├── [feature].service.ts      # Business logic (no Elysia imports)
├── [feature].repository.ts   # Drizzle queries only
└── [feature].model.ts        # TypeBox schemas
```

### Database Migrations

```bash
cd apps/api

# After modifying schema.ts
bun run generate   # Creates migration file
bun run migrate    # Applies to database
```

### Type Checking

```bash
cd apps/api && bun run tsc --noEmit
```

---

## Colyseus Development

### Project Structure

```
apps/game/src/
├── index.ts          # Server entry point
├── config.ts         # Configuration
├── rooms/
│   └── GameRoom.ts   # Room lifecycle + game loop
├── schemas/
│   └── GameState.ts  # Colyseus Schema definitions
├── systems/          # Movement, collision, combat, abilities
└── ai/               # AI patterns and opponent logic
```

### Build Commands

```bash
cd apps/game

bun run dev          # Development server
bun run build        # Production build
bun test             # Run tests
```

---

## Frontend Development

### SvelteKit with Eden Treaty

```typescript
// Type-safe API calls
import { api } from "$lib/api";

const { data, error } = await api.matchmaking.queue.post();
```

### Game Store Pattern

```typescript
// apps/web/src/lib/stores/game.svelte.ts
import { Client } from "colyseus.js";

class GameStore {
  #room: Room<GameState> | null = null;
  state = $state<GameState | null>(null);

  async connect(roomId: string) {
    const client = new Client("ws://localhost:3001");
    this.#room = await client.joinById<GameState>(roomId);
    this.#room.onStateChange((state) => {
      this.state = state;
    });
  }

  sendInput(keys: InputState) {
    this.#room?.send("input", keys);
  }
}
```

### Type Checking

```bash
cd apps/web && bun run check
```

---

## Code Quality

### Formatting & Linting

```bash
# Format all code
bun x ultracite fix

# Check for issues
bun x ultracite check
```

### Commit Convention

```
<type>(<scope>): <description>

feat(game): add dash ability with cooldown
fix(api): handle matchmaking timeout correctly
docs(readme): update setup instructions
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`chore`, `ci`

Scopes: `api`, `web`, `game`, `docs`

---

## Docker

### Full Stack

```bash
docker compose up --build      # Start all services
docker compose down -v         # Stop and remove volumes
docker compose logs -f api     # View API logs
docker compose logs -f game    # View game server logs
```

### Database Access

```bash
docker compose exec db psql -U postgres -d ft_transcendence
```

---

## Implementation Phases

See [Implementation Plan](./implementation-plan.md) for detailed roadmap:

1. **Phase 1:** Colyseus game server + core systems (rooms, 60Hz loop)
2. **Phase 2:** ElysiaJS integration (matchmaking, results, rankings)
3. **Phase 3:** Frontend game client (canvas, input, state sync)
