# Implementation Plan

Phased approach for implementing the bullet hell game with hybrid architecture.

---

## Phase 1: Colyseus Game Server + Core Systems

Set up the Colyseus game server and implement core gameplay.

### Deliverables

- Colyseus server with WebSocket transport
- Game Room with fixed timestep loop (60Hz)
- Schema-based state (players, bullets) with automatic sync
- 8-directional movement with focus mode
- Collision detection (spatial hashing, circle-circle)
- Combat (damage, HP, 3 lives)
- Bullet patterns (radial, aimed, spiral, wall)
- Ability system (dash, shield, bomb, ultimate)
- AI opponent with configurable difficulty
- Object pooling for bullets to reduce GC pressure

### Files

```
apps/game/
├── package.json
├── Dockerfile
└── src/
    ├── index.ts              # Colyseus server entry
    ├── config.ts             # Configuration
    ├── rooms/
    │   └── GameRoom.ts       # Room lifecycle + 60Hz loop
    ├── schemas/
    │   ├── GameState.ts      # Root state schema
    │   ├── PlayerSchema.ts   # Player entity schema
    │   └── BulletSchema.ts   # Bullet entity schema
    ├── systems/
    │   ├── movement.ts
    │   ├── collision.ts
    │   ├── combat.ts
    │   └── abilities.ts
    └── ai/
        ├── opponent.ts
        └── patterns.ts
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

- Internal API between ElysiaJS and Colyseus
  (`/internal/matches/complete`)
- Cross-service authentication (shared secret + session token for room join)
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
- [ ] Colyseus room created for matched players
- [ ] Match results posted back to ElysiaJS
- [ ] Elo ratings update correctly

---

## Phase 3: Frontend Game Client + Polish

Build the game UI and tie everything together.

### Deliverables

- Colyseus client SDK integration
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
  game:
    build:
      context: ./apps/game
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - API_URL=http://api:3000
      - NODE_ENV=production
    depends_on:
      - db
      - api
```

---

## Testing Checklist

- [ ] Game loop maintains 60Hz under load
- [ ] Collision detection is accurate
- [ ] Elo calculation matches expected values
- [ ] Colyseus room lifecycle (create, join, leave, dispose)
- [ ] Full matchmaking-to-game-completion flow
- [ ] Multiple concurrent rooms (target: 10)
- [ ] `docker compose up --build` starts cleanly from scratch

---

## Verification Commands

```bash
cd apps/game && bun run build        # Build game server
cd apps/game && bun test             # Run tests
docker compose up --build            # Start full stack
docker compose logs -f game          # View game server logs
```
