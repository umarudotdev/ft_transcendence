# Implementation Plan

Phased approach for implementing the bullet hell game with hybrid architecture.

---

## Phase 1: Rust Game Server + Core Systems

Set up the Rust game server and implement core gameplay.

### Deliverables

- Axum + tokio-tungstenite WebSocket server
- Fixed timestep game loop (60Hz)
- Entity system (players, bullets) with object pools
- 8-directional movement with focus mode
- Collision detection (spatial hashing, circle-circle)
- Combat (damage, HP, 3 lives)
- Bullet patterns (radial, aimed, spiral, wall)
- Ability system (dash, shield, bomb, ultimate)
- AI opponent with configurable difficulty
- MessagePack serialization for state broadcast

### Files

```
game-server/
├── Cargo.toml
├── Dockerfile
└── src/
    ├── main.rs
    ├── config.rs
    ├── server/
    │   ├── mod.rs
    │   ├── http.rs           # Internal API handler
    │   └── ws.rs             # Game WebSocket
    ├── game/
    │   ├── mod.rs
    │   ├── loop.rs           # Fixed timestep (60Hz)
    │   ├── state.rs          # Game state container
    │   └── systems/
    │       ├── mod.rs
    │       ├── movement.rs
    │       ├── collision.rs
    │       ├── combat.rs
    │       └── abilities.rs
    ├── entities/
    │   ├── mod.rs
    │   ├── player.rs
    │   └── bullet.rs
    ├── network/
    │   ├── mod.rs
    │   └── protocol.rs       # Message types, serialization
    └── ai/
        ├── mod.rs
        ├── opponent.rs
        └── patterns.rs
```

### Acceptance Criteria

- [ ] 60Hz loop runs with stable timing
- [ ] Players move, shoot, use abilities
- [ ] Collision detection works with spatial hashing
- [ ] Combat: damage, lives, game over
- [ ] AI opponent plays reasonably
- [ ] Docker container builds and starts

---

## Phase 2: ElysiaJS Integration + Matchmaking

Connect the game server to the API and implement matchmaking.

### Deliverables

- Internal API between ElysiaJS and Rust (`/internal/games/create`,
  `/internal/matches/complete`)
- Cross-service authentication (shared secret + short-lived JWT for player
  WebSocket)
- Matchmaking queue with Elo-based pairing
- Game session lifecycle management
- Match result recording and Elo updates
- Rankings and leaderboard

### Files

```
apps/api/src/modules/
├── matchmaking/
│   ├── matchmaking.controller.ts
│   ├── matchmaking.service.ts
│   ├── matchmaking.repository.ts
│   └── matchmaking.model.ts
└── rankings/
    ├── rankings.controller.ts
    ├── rankings.service.ts
    ├── rankings.repository.ts
    └── rankings.model.ts

apps/api/src/db/
└── schema.ts  # Add game_sessions, game_session_players, matchmaking_queue
```

### Acceptance Criteria

- [ ] Players join/leave matchmaking queue
- [ ] Queue pairs players within rating range
- [ ] Game session created in database
- [ ] Rust server receives game create request
- [ ] Match results posted back to ElysiaJS
- [ ] Elo ratings update correctly

---

## Phase 3: Frontend Game Client + Polish

Build the game UI and tie everything together.

### Deliverables

- Game WebSocket store
- Canvas renderer (players, bullets, effects)
- Keyboard input capture and transmission
- Client-side prediction and interpolation
- Matchmaking UI (queue, cancel, match found)
- Game HUD (HP, lives, cooldowns, abilities)
- Game over screen with results
- Visual effects and sound

### Files

```
apps/web/src/lib/
├── stores/
│   └── game.svelte.ts
├── components/game/
│   ├── GameCanvas.svelte
│   ├── GameHUD.svelte
│   ├── GameOverlay.svelte
│   └── MatchmakingModal.svelte
└── game/
    ├── renderer.ts
    ├── input.ts
    ├── prediction.ts
    ├── interpolation.ts
    ├── effects.ts
    └── audio.ts

apps/web/src/routes/(app)/play/
├── +page.svelte
└── [sessionId]/
    └── +page.svelte
```

### Acceptance Criteria

- [ ] Canvas renders players and bullets smoothly
- [ ] Input feels responsive with client prediction
- [ ] Matchmaking queue UI works end-to-end
- [ ] Game completes and records results
- [ ] HUD shows all game state
- [ ] Works in Docker container

---

## Docker Compose

Add game server to `compose.yaml`:

```yaml
services:
  # ... existing services ...
  game-server:
    build:
      context: ./game-server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/ft_transcendence
      - API_URL=http://api:3000
      - RUST_LOG=info
    depends_on:
      - db
      - api
```

---

## Testing Checklist

- [ ] Game loop maintains 60Hz under load
- [ ] Collision detection is accurate
- [ ] Elo calculation matches expected values
- [ ] WebSocket connection lifecycle (connect, play, disconnect)
- [ ] Full matchmaking-to-game-completion flow
- [ ] Multiple concurrent games (target: 10)
- [ ] `docker compose up --build` starts cleanly from scratch

---

## Verification Commands

```bash
cd game-server && cargo build        # Build game server
cd game-server && cargo test         # Run Rust tests
docker compose up --build            # Start full stack
docker compose logs -f game-server   # View game server logs
```
