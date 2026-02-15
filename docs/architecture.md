# Architecture

Technical patterns and protocols for ft_transcendence bullet hell game.

> **Rationale:** See [ADRs](./decisions/0001-use-bun-elysia-sveltekit-stack) for
> decision records, especially
> [ADR 0009](./decisions/0009-use-hybrid-rust-game-server) for the hybrid
> architecture decision.

---

## 1. Tech Stack

| Component       | Choice                   | Why                                           |
| --------------- | ------------------------ | --------------------------------------------- |
| **Runtime**     | Bun (API) + Rust (Game)  | TypeScript for CRUD, Rust for real-time perf  |
| **Monorepo**    | Bun Workspaces           | Dependency linking without TurboRepo overhead |
| **Frontend**    | SvelteKit                | SSR (1pt), smaller bundles, simple stores     |
| **API Server**  | ElysiaJS                 | Bun-optimized, Eden Treaty type safety        |
| **Game Server** | Axum + Tokio             | Async runtime, predictable timing, no GC      |
| **Database**    | PostgreSQL + Drizzle     | Relational integrity, TypeScript-native ORM   |
| **Auth**        | Arctic + Oslo            | 42 OAuth + TOTP, database sessions            |
| **Styling**     | Tailwind + Shadcn-Svelte | Utility CSS, accessible primitives            |
| **Tooling**     | Biome + Lefthook         | Fast formatting, parallel pre-commit          |
| **Infra**       | Docker + Nginx           | HTTPS termination, single-command deploy      |

---

## 2. Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (SvelteKit)                       │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Auth Pages │  │   Lobby     │  │ Game Canvas │  │    Chat     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          │ HTTP           │ HTTP           │ WebSocket      │ WebSocket
          │                │                │ (60Hz)         │
          ▼                ▼                │                ▼
┌─────────────────────────────────────┐    │    ┌─────────────────────┐
│        ElysiaJS API Server          │    │    │   Rust Game Server  │
│                                     │    │    │                     │
│  • Auth (OAuth, 2FA, sessions)      │    │    │  • 60Hz game loop   │
│  • User management                  │◄───┼───►│  • Entity systems   │
│  • Matchmaking queue                │    │    │  • Physics/collision│
│  • Rankings & Elo                   │    │    │  • Combat & abilities│
│  • Chat system                      │    │    │  • AI patterns      │
│  • Match history                    │    │    │                     │
└──────────────┬──────────────────────┘    │    └──────────┬──────────┘
               │                           │               │
               │           Internal API    │               │
               │    (game create/complete) │               │
               │    ◄──────────────────────┼───────────────┤
               │                           │               │
               ▼                           │               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database                           │
│                                                                      │
│   users │ sessions │ matches │ game_sessions │ matchmaking_queue    │
└─────────────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Player clicks "Find Match"**
   - Frontend → ElysiaJS `POST /api/matchmaking/queue`

2. **ElysiaJS finds opponent, creates match**
   - ElysiaJS → Rust `POST /internal/games/create`
   - ElysiaJS → Frontend (WebSocket: `match_found`, `game_server_url`)

3. **Players connect to game server**
   - Frontend → Rust (WebSocket: `join_game`)

4. **Game runs at 60Hz**
   - Rust handles all game logic
   - Rust → Frontend (WebSocket: `game_state` @ 60Hz)
   - Frontend → Rust (WebSocket: `player_input`)

5. **Game ends**
   - Rust → ElysiaJS `POST /internal/matches/complete`
   - ElysiaJS updates ratings, achievements, stats

---

## 3. Directory Structure

```text
ft_transcendence/
├── apps/
│   ├── api/                      # ElysiaJS backend
│   │   └── src/
│   │       ├── common/           # Shared guards, decorators, types
│   │       ├── db/               # Drizzle config, schema, migrations
│   │       └── modules/          # Vertical slices
│   │           ├── auth/         # OAuth, 2FA, sessions
│   │           ├── chat/         # WebSocket chat
│   │           ├── matchmaking/  # Queue management
│   │           ├── rankings/     # Elo, leaderboards
│   │           └── users/        # Profile, friends, stats
│   │
│   └── web/                      # SvelteKit frontend
│       └── src/
│           ├── lib/
│           │   ├── api.ts        # Eden Treaty client
│           │   ├── stores/       # Svelte stores
│           │   ├── components/   # UI components
│           │   └── game/         # Game renderer, input
│           └── routes/           # SvelteKit pages
│
├── game-server/                  # Rust game server
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── server/               # HTTP + WebSocket
│       ├── game/                 # Game loop, state
│       │   └── systems/          # Movement, collision, combat
│       ├── entities/             # Player, bullet
│       ├── network/              # Protocol, sync
│       └── ai/                   # AI patterns
│
├── packages/                     # Shared types/configs
├── biome.json
├── compose.yaml
└── package.json
```

---

## 4. Backend Patterns

### ElysiaJS - Vertical Slice Pattern

Each feature module contains all its layers:

```
modules/auth/
├── auth.controller.ts    # HTTP + validation (TypeBox). NO DB calls.
├── auth.service.ts       # Business logic (framework-agnostic)
├── auth.repository.ts    # Drizzle queries (ONLY DB access point)
└── auth.model.ts         # TypeBox schemas
```

### Rust - Entity Component System

```
game-server/src/
├── game/
│   ├── loop.rs           # Fixed timestep (60Hz)
│   ├── state.rs          # Game state container
│   └── systems/
│       ├── movement.rs   # Player movement, focus mode
│       ├── collision.rs  # Spatial hash, hitbox detection
│       ├── combat.rs     # Damage, HP, lives
│       └── abilities.rs  # Cooldowns, effects
└── entities/
    ├── player.rs         # Ship entity
    └── bullet.rs         # Projectile entity
```

---

## 5. Authentication

Database sessions (not JWT) for immediate revocation.

### OAuth Flow

1. Redirect to 42 Intra (Arctic generates URL)
2. Callback → exchange code for token → fetch profile
3. Upsert user, create session, set HttpOnly cookie
4. Each request validates session from DB

### 2FA Flow (Oslo TOTP)

1. Enable → generate secret, show QR code
2. User scans with authenticator app
3. Login prompts for 6-digit code if 2FA enabled

---

## 6. WebSocket Protocols

### Game (`ws://game-server:3001/ws?sessionId={id}&token={jwt}`)

```typescript
// Client → Server
{ type: "input", keys: { up: bool, down: bool, left: bool, right: bool, focus: bool, fire: bool } }
{ type: "ability", slot: 1 | 2 | 3 }  // Q, E, R
{ type: "ready" }

// Server → Client (60Hz)
{
  type: "state",
  tick: number,
  players: [{ id, x, y, hp, lives, cooldowns }],
  bullets: [{ id, x, y, owner }],
  effects: [{ type, x, y }]
}
{ type: "countdown", seconds: 3 }
{ type: "hit", playerId, damage }
{ type: "death", playerId, livesRemaining }
{ type: "gameOver", winner: playerId, stats }
```

### Chat (`wss://localhost/api/chat/ws`)

```typescript
// Client → Server
{ type: "message", to: recipientId, content: string }

// Server → Client
{ type: "message", from: senderId, content: string, timestamp: string }
{ type: "userOnline", userId: number }
```

---

## 7. Frontend Integration

### Eden Treaty Client

```typescript
// apps/web/src/lib/api.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";

export const api = treaty<App>("https://localhost/api");

// Full autocomplete from backend types
const { data, error } = await api.matchmaking.queue.post();
```

### Game Store Pattern

```typescript
// apps/web/src/lib/stores/game.svelte.ts
class GameStore {
  #ws: WebSocket | null = null;
  state = $state<GameState | null>(null);

  connect(sessionId: string, token: string) {
    this.#ws = new WebSocket(
      `ws://game-server:3001/ws?sessionId=${sessionId}&token=${token}`,
    );
    this.#ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") {
        this.state = msg;
      }
    };
  }

  sendInput(keys: InputState) {
    this.#ws?.send(JSON.stringify({ type: "input", keys }));
  }
}
```

### State Management

| Type         | Solution                              |
| ------------ | ------------------------------------- |
| Server data  | SvelteKit `load` functions            |
| Client state | Svelte stores (`writable`, `derived`) |
| Game state   | WebSocket → game store                |
| Forms        | Superforms + Zod                      |

---

## 8. Database Schema

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ game_session_players : joins
    users ||--o{ matches : plays
    users ||--o{ messages : sends

    game_sessions ||--o{ game_session_players : has
    game_sessions ||--o{ matches : records

    users {
        serial id PK
        integer intra_id UK
        text username UK
        text avatar_url
        text totp_secret
        boolean totp_enabled
        integer rating
        timestamp created_at
    }

    sessions {
        text session_id PK
        integer user_id FK
        timestamp expires_at
    }

    game_sessions {
        uuid id PK
        text mode
        jsonb config
        text state
        text server_url
        timestamp created_at
        timestamp started_at
        timestamp ended_at
    }

    game_session_players {
        serial id PK
        uuid session_id FK
        integer user_id FK
        integer team
        boolean ready
    }

    matchmaking_queue {
        serial id PK
        integer user_id FK UK
        text mode
        integer rating
        timestamp queued_at
    }

    matches {
        serial id PK
        uuid session_id FK
        integer winner_id FK
        jsonb game_data
        timestamp played_at
    }
```

---

## 9. Commands

| Task              | Command                               |
| ----------------- | ------------------------------------- |
| Start stack       | `docker compose up --build`           |
| Install deps      | `bun install`                         |
| API migrations    | `cd apps/api && bun run migrate`      |
| Build game server | `cd game-server && cargo build`       |
| Run game server   | `cd game-server && cargo run`         |
| Format            | `bun x ultracite fix`                 |
| Type check API    | `cd apps/api && bun run tsc --noEmit` |
| Type check Web    | `cd apps/web && bun run check`        |
| Rust tests        | `cd game-server && cargo test`        |
