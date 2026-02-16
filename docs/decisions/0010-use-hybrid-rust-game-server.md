# ADR 0010: Use Hybrid Architecture with Rust Game Server

## Status

Superseded by
[ADR 0011: Use Colyseus for Game Server](./0011-use-colyseus-for-game-server.md)

## Context

We are pivoting from Pong to a bullet hell shoot 'em up game. Bullet hell games
have demanding performance requirements:

- High entity counts (hundreds of bullets per frame)
- 60Hz game loop with minimal jitter
- Precise collision detection
- Low-latency state synchronization

While ElysiaJS handles HTTP/WebSocket well, a dedicated game server provides:

- Predictable frame timing (no GC pauses)
- Better CPU utilization for physics calculations
- Memory efficiency with many entities
- Separation of concerns between API and real-time game logic

## Decision

Adopt a **hybrid architecture**:

1. **Keep ElysiaJS** for:
   - Authentication (OAuth, 2FA, sessions)
   - User management (profiles, friends, stats)
   - Chat system (channels, messages)
   - Matchmaking (queue management, player pairing)
   - Rankings (Elo calculations, leaderboards)
   - Gamification (achievements, points, streaks)
   - Notifications and moderation

2. **Add Rust game server** for:
   - 60Hz game loop with fixed timestep
   - Entity management (players, bullets)
   - Physics and collision detection
   - Combat system (damage, HP, lives)
   - Ability system (cooldowns, effects)
   - AI patterns for PvE modes
   - Real-time state synchronization

### Technology Choices (Rust)

| Component     | Choice            | Rationale                    |
| ------------- | ----------------- | ---------------------------- |
| Runtime       | Tokio             | Async runtime, battle-tested |
| Web Framework | Axum              | Ergonomic, tower-based       |
| WebSocket     | tokio-tungstenite | Async WebSocket              |
| Serialization | serde + rmp       | MessagePack for bandwidth    |
| Database      | sqlx              | Compile-time checked SQL     |

### Communication Flow

```
1. Player clicks "Find Match"
   Frontend → ElysiaJS (POST /api/matchmaking/queue)

2. ElysiaJS finds opponent, creates match
   ElysiaJS → Rust (POST /internal/games/create)
   ElysiaJS → Frontend (WebSocket: match_found, game_server_url)

3. Players connect to game server
   Frontend → Rust (WebSocket: join_game)

4. Game runs at 60Hz
   Rust handles all game logic
   Rust → Frontend (WebSocket: game_state @ 60Hz)
   Frontend → Rust (WebSocket: player_input)

5. Game ends
   Rust → ElysiaJS (POST /internal/matches/complete)
   ElysiaJS updates ratings, achievements, stats
```

## Consequences

### Positive

- Predictable game loop timing (no JS event loop interference)
- Better performance for physics-heavy gameplay
- Clear separation between API and game logic
- Rust's type system prevents many runtime errors
- Memory safety without GC pauses

### Negative

- Two languages to maintain (TypeScript + Rust)
- Additional deployment complexity
- Learning curve for Rust
- Need for internal API between services

### Neutral

- Shared PostgreSQL database
- Same Docker Compose deployment
- WebSocket protocol remains similar

## Directory Structure

```
ft_transcendence/
├── apps/
│   ├── api/                 # ElysiaJS backend (existing)
│   └── web/                 # SvelteKit frontend (existing)
├── game-server/             # Rust game server (new)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── server/          # HTTP + WebSocket
│   │   ├── game/            # Game loop, systems
│   │   ├── network/         # Protocol, sync
│   │   └── ai/              # AI patterns
│   └── Dockerfile
└── docker-compose.yaml      # Updated for new service
```

## References

- [Tokio](https://tokio.rs/)
- [Axum](https://github.com/tokio-rs/axum)
- [Game Loop Pattern](https://gameprogrammingpatterns.com/game-loop.html)
