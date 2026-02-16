# Architecture

Technical patterns and protocols for ft_transcendence bullet hell game.

> **Rationale:** See [ADRs](./decisions/0001-use-bun-elysia-sveltekit-stack) for
> decision records, especially
> [ADR 0011](./decisions/0011-use-colyseus-for-game-server) for the Colyseus
> game server decision.

---

## 1. Tech Stack

| Component       | Choice                       | Why                                           |
| --------------- | ---------------------------- | --------------------------------------------- |
| **Runtime**     | Bun                          | Single runtime for API, game server, frontend |
| **Monorepo**    | Bun Workspaces               | Dependency linking without TurboRepo overhead |
| **Frontend**    | SvelteKit                    | SSR (1pt), smaller bundles, simple stores     |
| **API Server**  | ElysiaJS                     | Bun-optimized, Eden Treaty type safety        |
| **Game Server** | Colyseus                     | Room-based multiplayer, automatic state sync  |
| **Database**    | PostgreSQL + Drizzle         | Relational integrity, TypeScript-native ORM   |
| **Auth**        | Arctic + Oslo                | 42 OAuth + TOTP, database sessions            |
| **Styling**     | Tailwind + Shadcn-Svelte     | Utility CSS, accessible primitives            |
| **Tooling**     | Biome + Lefthook             | Fast formatting, parallel pre-commit          |
| **Infra**       | Docker + Nginx               | HTTPS termination, single-command deploy      |

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
          │ HTTP           │ HTTP           │ Colyseus SDK   │ WebSocket
          │                │                │ (WebSocket)    │
          ▼                ▼                │                ▼
┌─────────────────────────────────────┐    │    ┌─────────────────────┐
│        ElysiaJS API Server          │    │    │ Colyseus Game Server│
│                                     │    │    │                     │
│  • Auth (OAuth, 2FA, sessions)      │    │    │  • Game rooms       │
│  • User management                  │◄───┼───►│  • 60Hz game loop   │
│  • Matchmaking queue                │    │    │  • Physics/collision│
│  • Rankings & Elo                   │    │    │  • Combat & abilities│
│  • Chat system                      │    │    │  • AI patterns      │
│  • Match history                    │    │    │  • State sync       │
└──────────────┬──────────────────────┘    │    └──────────┬──────────┘
               │                           │               │
               │           Internal API    │               │
               │    (match complete)       │               │
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

2. **ElysiaJS pairs players, returns room ID**
   - ElysiaJS → Frontend (WebSocket: `match_found`, `roomId`)

3. **Players join Colyseus room**
   - Frontend → Colyseus (`client.joinById(roomId)`)

4. **Game runs at 60Hz**
   - Colyseus Room handles all game logic
   - Colyseus → Frontend (state patches @ 60Hz)
   - Frontend → Colyseus (`room.send("input", keys)`)

5. **Game ends**
   - Colyseus Room → ElysiaJS `POST /internal/matches/complete`
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
│   ├── game/                     # Colyseus game server
│   │   └── src/
│   │       ├── index.ts          # Server entry point
│   │       ├── config.ts         # Configuration
│   │       ├── rooms/
│   │       │   └── GameRoom.ts   # Game room handler
│   │       ├── schemas/
│   │       │   └── GameState.ts  # Colyseus Schema definitions
│   │       ├── systems/          # Movement, collision, combat
│   │       └── ai/              # AI patterns
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

### Colyseus - Room-Based Game Server

```
apps/game/src/
├── rooms/
│   └── GameRoom.ts       # Room lifecycle (onCreate, onJoin, onMessage, onLeave)
├── schemas/
│   └── GameState.ts      # Schema with auto-sync (players, bullets, effects)
├── systems/
│   ├── movement.ts       # Player movement, focus mode
│   ├── collision.ts      # Spatial hash, hitbox detection
│   ├── combat.ts         # Damage, HP, lives
│   └── abilities.ts      # Cooldowns, effects
└── ai/
    ├── opponent.ts        # AI controller
    └── patterns.ts        # Bullet patterns
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

### Game (Colyseus Room)

```typescript
// Client → Server (room.send)
{ type: "input", keys: { up: bool, down: bool, left: bool, right: bool, focus: bool, fire: bool } }
{ type: "ability", slot: 1 | 2 | 3 }  // Q, E, R
{ type: "ready" }

// Server → Client (automatic state sync via Colyseus Schema patches @ 60Hz)
// GameState schema:
{
  players: MapSchema<PlayerSchema>,   // id, x, y, hp, lives, cooldowns
  bullets: ArraySchema<BulletSchema>, // id, x, y, owner
  effects: ArraySchema<EffectSchema>, // type, x, y
  tick: number,
}

// Server → Client (room broadcast)
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

### State Management

| Type         | Solution                              |
| ------------ | ------------------------------------- |
| Server data  | SvelteKit `load` functions            |
| Client state | Svelte stores (`writable`, `derived`) |
| Game state   | Colyseus state sync → game store      |
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
        text room_id
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
| Build game server | `cd apps/game && bun run build`       |
| Run game server   | `cd apps/game && bun run dev`         |
| Format            | `bun x ultracite fix`                 |
| Type check API    | `cd apps/api && bun run tsc --noEmit` |
| Type check Web    | `cd apps/web && bun run check`        |
