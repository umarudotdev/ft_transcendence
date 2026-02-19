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
- Server-authoritative mouse aim (aimAngle)
- Collision detection (circle-circle) with graze mechanic
- Combat (damage, HP, 3 lives) with angular velocity on spread bullets
- Ability system (dash, bomb, ultimate) with bug fixes
- Client-side particle system and additive glow rendering

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
    │   ├── PlayerSchema.ts   # Player entity (x, y, hp, aimAngle, etc.)
    │   └── BulletSchema.ts   # Bullet entity (angularVelocity, fireMode)
    └── systems/
        ├── movement.ts       # Player + bullet movement, angular velocity
        ├── collision.ts      # Hit detection + graze detection
        ├── combat.ts         # Fire modes, aim-based bullet spawning
        └── abilities.ts      # Dash (clamped), bomb, ultimate (range-limited)
```

### Acceptance Criteria

- [x] 60Hz loop runs with stable timing
- [x] Players move, shoot, use abilities
- [x] Collision detection with graze mechanic
- [x] Combat: damage, lives, game over
- [x] Dash clamps to canvas bounds
- [x] isDashing flag persists for animation
- [x] Ultimate damage range-limited to 200px
- [x] Spread bullets curve via angular velocity
- [x] Server-authoritative aim via mouse cursor
- [x] Graze charges defender's ultimate
- [x] Docker container builds and starts

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

- [x] Players join/leave matchmaking queue
- [x] Queue pairs players within rating range
- [x] Game session created in database
- [x] Colyseus room created for matched players
- [x] Match results posted back to ElysiaJS
- [x] Elo ratings update correctly

---

## Phase 3: Frontend Game Client + Polish

Build the game UI and tie everything together.

### Deliverables

- Colyseus client SDK integration
- Canvas renderer with additive glow and particle effects
- Keyboard + mouse input capture and transmission
- Client-side interpolation (100ms delay, 20Hz→60FPS)
- Matchmaking UI (queue, cancel, match found)
- Game HUD (HP, lives, cooldowns, abilities, opponent cooldowns)
- Game over screen with results
- Bullet visual differentiation (spread circles vs focus lines)

### Files

```
apps/web/src/lib/
├── stores/
│   └── game.svelte.ts
├── components/game/
│   ├── GameCanvas.svelte
│   ├── GameHUD.svelte
│   ├── GameOverlay.svelte
│   ├── GameResultScreen.svelte
│   ├── MatchFoundScreen.svelte
│   ├── MatchmakingOverlay.svelte
│   └── QueueScreen.svelte
└── game/
    ├── renderer.ts          # Additive glow, batch rendering, ship rotation
    ├── particles.ts         # 1024-particle pool, ring-buffer allocation
    ├── input.ts             # Keyboard + mouse aim (aimAngle)
    ├── interpolation.ts     # 100ms delay buffer, lerp between server states
    └── matchmaking-utils.ts # Queue state utilities

apps/web/src/routes/(app)/play/
├── +page.svelte
└── [sessionId]/
    └── +page.svelte
```

### Acceptance Criteria

- [x] Canvas renders players and bullets with glow effects
- [x] Mouse aim feels responsive with server-authoritative validation
- [x] Matchmaking queue UI works end-to-end
- [x] Game completes and records results
- [x] HUD shows all game state including opponent cooldowns
- [x] Particle effects for hits, deaths, dashes, bombs, ultimates, grazes
- [x] Works in Docker container

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

- [x] Game loop maintains 60Hz under load
- [x] Collision detection is accurate (hit + graze)
- [x] Elo calculation matches expected values
- [x] Colyseus room lifecycle (create, join, leave, dispose)
- [x] Full matchmaking-to-game-completion flow
- [ ] Multiple concurrent rooms (target: 10)
- [x] `docker compose up --build` starts cleanly from scratch
- [x] 70 game server tests pass
- [x] 103 web tests pass

---

## Verification Commands

```bash
cd apps/game && bun run build        # Build game server
cd apps/game && bun test             # Run tests
docker compose up --build            # Start full stack
docker compose logs -f game          # View game server logs
```
