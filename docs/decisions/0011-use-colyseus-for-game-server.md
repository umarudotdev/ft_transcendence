# ADR 0011: Use Colyseus for Game Server

## Status

Accepted (supersedes
[ADR 0010: Hybrid Architecture with Rust Game Server](./0010-use-hybrid-rust-game-server.md))

## Context

ADR 0010 chose a hybrid architecture with a dedicated Rust game server (Axum +
Tokio) for the bullet hell game. While Rust offers excellent performance
characteristics, the two-language stack introduces significant complexity:

- Two build systems (Bun + Cargo)
- Two deployment pipelines
- Learning curve for Rust across the team
- Internal HTTP API needed between ElysiaJS and Rust
- Duplicate type definitions (TypeScript + Rust structs)

The game's requirements (1v1 bullet hell at 60Hz with ~100-200 entities) are
well within what a TypeScript runtime can handle. The real challenge is
multiplayer state synchronization, room management, and reconnection — problems
that Colyseus solves out of the box.

## Decision

Replace the custom Rust game server with **Colyseus**, a TypeScript multiplayer
game framework running on Bun.

### What Colyseus Provides

| Feature                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| **Room-based sessions** | Each game is a Room with server-authoritative state |
| **Schema state sync**   | Automatic binary delta patches at configurable rate |
| **Matchmaking**         | Built-in `filterBy` room matching                   |
| **Reconnection**        | `allowReconnection()` with seat reservation         |
| **Transport**           | WebSocket with automatic serialization              |
| **Monitoring**          | `@colyseus/monitor` dashboard for debugging         |

### Architecture

The hybrid architecture remains — two backend services — but both are now
TypeScript:

1. **ElysiaJS (apps/api)** — HTTP/REST services (auth, users, chat, rankings)
2. **Colyseus (apps/game)** — Real-time game rooms (game loop, physics, combat)

### Communication Flow

```
1. Player clicks "Find Match"
   Frontend → ElysiaJS (POST /api/matchmaking/queue)

2. ElysiaJS pairs players, returns Colyseus room ID
   ElysiaJS → Frontend (WebSocket: match_found, roomId)

3. Players join Colyseus room
   Frontend → Colyseus (client.joinById(roomId))

4. Game runs at 60Hz
   Colyseus Room handles all game logic
   Colyseus → Frontend (state patches @ 60Hz)
   Frontend → Colyseus (room.send("input", keys))

5. Game ends
   Colyseus Room → ElysiaJS (POST /internal/matches/complete)
   ElysiaJS updates ratings, achievements, stats
```

### Technology Choices

| Component     | Choice            | Rationale                             |
| ------------- | ----------------- | ------------------------------------- |
| Runtime       | Bun               | Same runtime as API server            |
| Framework     | Colyseus 0.17     | Room-based multiplayer, state sync    |
| Transport     | WebSocket         | Built into Colyseus                   |
| Serialization | Colyseus Schema   | Binary delta encoding, auto-generated |
| Monitoring    | @colyseus/monitor | Built-in room/client dashboard        |

## Consequences

### Positive

- **Single language**: TypeScript everywhere — shared types, shared tooling
- **Faster development**: No Rust learning curve, familiar async/await
- **Built-in multiplayer**: State sync, reconnection, matchmaking solved by
  framework
- **Simpler deployment**: One runtime, one package manager, one Docker base
  image
- **Shared types**: Game state schemas can be imported by frontend directly
- **Bun workspace**: Game server joins the monorepo as `apps/game`

### Negative

- **Less raw performance**: TypeScript/Bun is slower than Rust for
  physics-heavy computation
- **GC pauses**: Possible jitter from garbage collection (mitigated by object
  pooling)
- **Framework dependency**: Tied to Colyseus release cycle and design decisions

### Mitigations

- Entity counts for 1v1 (~200 bullets) are well within JS performance budget
- Object pooling for bullets avoids GC pressure
- Colyseus Schema uses binary encoding — efficient on the wire
- If performance becomes an issue, hot paths can be optimized with
  `SharedArrayBuffer` or WASM

## Directory Structure

```
ft_transcendence/
├── apps/
│   ├── api/                      # ElysiaJS backend (existing)
│   ├── game/                     # Colyseus game server (new)
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts          # Server entry point
│   │       ├── config.ts         # Configuration
│   │       ├── rooms/
│   │       │   └── GameRoom.ts   # Game room handler
│   │       ├── schemas/
│   │       │   └── GameState.ts  # Colyseus Schema definitions
│   │       ├── systems/
│   │       │   ├── movement.ts   # Movement system
│   │       │   ├── collision.ts  # Collision detection
│   │       │   ├── combat.ts     # Damage, HP, lives
│   │       │   └── abilities.ts  # Cooldowns, effects
│   │       └── ai/
│   │           ├── opponent.ts   # AI controller
│   │           └── patterns.ts   # Bullet patterns
│   └── web/                      # SvelteKit frontend (existing)
└── docker-compose.yaml
```

## References

- [Colyseus documentation](https://docs.colyseus.io/)
- [Colyseus GitHub](https://github.com/colyseus/colyseus)
- [ADR 0010: Hybrid Architecture with Rust](./0010-use-hybrid-rust-game-server.md)
  (superseded)
