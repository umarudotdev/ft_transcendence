# Development Guide

This guide covers setting up the development environment and implementing
features for the ft_transcendence bullet hell game.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Rust](https://rustup.rs/) >= 1.75
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
cd game-server && cargo run &
bun run dev
```

## Project Structure

```
ft_transcendence/
├── apps/
│   ├── api/           # ElysiaJS - auth, matchmaking, chat, rankings
│   └── web/           # SvelteKit - frontend
├── game-server/       # Rust - game loop, physics, combat
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

2. **Rust Game Server (game-server)** handles:
   - 60Hz fixed timestep game loop
   - Player movement and physics
   - Bullet spawning and collision
   - Combat (damage, HP, lives)
   - Abilities and cooldowns

### Communication Flow

```
Frontend → ElysiaJS: "Find match"
ElysiaJS → Rust: "Create game for players A, B"
Frontend → Rust: WebSocket connection for game state
Rust → Frontend: 60Hz state updates
Rust → ElysiaJS: "Game over, winner is A"
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

## Rust Development

### Project Structure

```
game-server/src/
├── main.rs           # Entry point
├── config.rs         # Configuration
├── server/           # HTTP + WebSocket handlers
├── game/             # Game loop, state, systems
├── entities/         # Player, bullet
├── network/          # Protocol, sync
└── ai/               # AI patterns
```

### Build Commands

```bash
cd game-server

cargo build          # Debug build
cargo build --release # Release build
cargo test           # Run tests
cargo run            # Run server
cargo clippy         # Lint
cargo fmt            # Format
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
class GameStore {
  #ws: WebSocket | null = null;
  state = $state<GameState | null>(null);

  connect(sessionId: string) {
    this.#ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${sessionId}`);
    this.#ws.onmessage = (e) => {
      this.state = JSON.parse(e.data);
    };
  }

  sendInput(keys: InputState) {
    this.#ws?.send(JSON.stringify({ type: "input", keys }));
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
docker compose logs -f game-server  # View game server logs
```

### Database Access

```bash
docker compose exec db psql -U postgres -d ft_transcendence
```

---

## Implementation Phases

See [Implementation Plan](./implementation-plan.md) for detailed roadmap:

1. **Phase 1:** Rust game server skeleton (WebSocket, 60Hz loop)
2. **Phase 2:** Core game systems (movement, collision, combat)
3. **Phase 3:** ElysiaJS integration (matchmaking, results)
4. **Phase 4:** Frontend game client (canvas, input, state)
5. **Phase 5:** Abilities and polish (cooldowns, effects)
6. **Phase 6:** AI and additional modes (PvE, FFA)
