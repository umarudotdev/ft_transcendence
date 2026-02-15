# Product Requirements

| Project          | Version | Status |
| :--------------- | :------ | :----- |
| ft_transcendence | 2.0     | Draft  |

---

## Executive Summary

Real-time bullet hell shoot 'em up platform for 42 students with multiplayer
gameplay, ranked matchmaking, chat, and 2FA. Target: **14 points** using hybrid
TypeScript + Rust stack.

## Success Metrics

| Metric           | Target               |
| :--------------- | :------------------- |
| Evaluation Score | >= 14 points         |
| Game Latency     | < 50ms local network |
| Tick Rate        | 60Hz stable          |
| Concurrent Games | 10 simultaneous      |
| Page Load (SSR)  | < 2 seconds          |

---

## Module Selection (14 Points)

| Category      | Pts | Modules                                               |
| :------------ | :-- | :---------------------------------------------------- |
| **Web**       | 4   | Frontend + Backend Frameworks (2) + SSR (1) + ORM (1) |
| **Gaming**    | 6   | Web Game (2) + Remote Players (2) + AI Opponent (2)   |
| **User Mgmt** | 3   | Standard User Mgmt (2) + Game Stats (1)               |
| **Security**  | 1   | 2FA TOTP (1)                                          |

---

## User Stories

### Auth & Profile (Sprint 1-2)

| ID    | Story                   | Priority    |
| :---- | :---------------------- | :---------- |
| US-01 | Login via 42 OAuth      | Must Have   |
| US-02 | Enable 2FA (TOTP/QR)    | Should Have |
| US-03 | Upload avatar (max 2MB) | Should Have |
| US-04 | View match history      | Should Have |
| US-05 | Add/remove friends      | Should Have |
| US-06 | Edit display name       | Could Have  |

### Gameplay (Sprint 2-4)

| ID    | Story                                     | Priority   |
| :---- | :---------------------------------------- | :--------- |
| US-07 | Matchmaking queue (rating-based)          | Must Have  |
| US-08 | Play vs AI (configurable difficulty)      | Must Have  |
| US-09 | 8-directional movement with focus mode    | Must Have  |
| US-10 | Use abilities (Q, E, R)                   | Must Have  |
| US-11 | Win by depleting opponent lives (3 lives) | Must Have  |
| US-12 | View Elo rating and tier                  | Must Have  |
| US-13 | Spectator mode                            | Could Have |

### Social & Chat (Sprint 3-4)

| ID    | Story                          | Priority    |
| :---- | :----------------------------- | :---------- |
| US-14 | Direct messages (WebSocket)    | Should Have |
| US-15 | Block users                    | Should Have |
| US-16 | Invite friends to private game | Should Have |

---

## Game Specs

| Property    | Value                        |
| :---------- | :--------------------------- |
| Genre       | Bullet hell / shoot 'em up   |
| Perspective | Top-down                     |
| Canvas      | 800×600px (responsive)       |
| Player Ship | 32×32px visual, 6×6px hitbox |
| Tick Rate   | 60/second                    |
| Network     | WebSocket at 60Hz            |

### Movement

| Mode   | Speed    | Hitbox  |
| :----- | :------- | :------ |
| Normal | 300 px/s | Hidden  |
| Focus  | 150 px/s | Visible |

### Combat

| Action       | Input | Cooldown | Description                  |
| :----------- | :---- | :------- | :--------------------------- |
| Primary Fire | Space | None     | Continuous projectile stream |
| Ability 1    | Q     | 8s       | Dash / Shield / Special shot |
| Ability 2    | E     | 12s      | AoE / Bomb / Utility         |
| Ultimate     | R     | Charged  | Powerful attack (60s charge) |

### Win Condition

- **Last Standing:** 3 lives per player, last alive wins
- Elo rating adjustment based on match outcome

---

## API Endpoints

### Auth

| Method | Path                    | Description          |
| :----- | :---------------------- | :------------------- |
| GET    | `/api/auth/42`          | Redirect to 42 OAuth |
| GET    | `/api/auth/42/callback` | OAuth callback       |
| POST   | `/api/auth/logout`      | Destroy session      |
| POST   | `/api/auth/2fa/enable`  | Generate TOTP QR     |
| POST   | `/api/auth/2fa/verify`  | Verify TOTP code     |

### Users

| Method    | Path                   | Description          |
| :-------- | :--------------------- | :------------------- |
| GET/PATCH | `/api/users/me`        | Current user profile |
| GET       | `/api/users/:id`       | User by ID           |
| GET       | `/api/users/:id/stats` | Game statistics      |

### Matchmaking

| Method      | Path                     | Description          |
| :---------- | :----------------------- | :------------------- |
| POST/DELETE | `/api/matchmaking/queue` | Join/leave queue     |
| POST        | `/api/matchmaking/ai`    | Start AI game        |
| WS          | `/api/matchmaking/ws`    | Queue status updates |

### Game (Rust Server)

| Method | Path                         | Description              |
| :----- | :--------------------------- | :----------------------- |
| WS     | `ws://game-server:3001/ws`   | Game state WebSocket     |
| POST   | `/internal/games/create`     | Create game (internal)   |
| POST   | `/internal/matches/complete` | Record result (internal) |

### Rankings

| Method | Path                    | Description       |
| :----- | :---------------------- | :---------------- |
| GET    | `/api/rankings`         | Leaderboard       |
| GET    | `/api/rankings/:userId` | User rank & stats |

### Social

| Method                | Path               | Description       |
| :-------------------- | :----------------- | :---------------- |
| GET/POST/PATCH/DELETE | `/api/friends/:id` | Friend management |
| POST/DELETE           | `/api/blocks/:id`  | Block management  |
| WS                    | `/api/chat/ws`     | Chat WebSocket    |

---

## Ranked System

| Tier     | Rating Range |
| :------- | :----------- |
| Bronze   | 0 - 999      |
| Silver   | 1000 - 1499  |
| Gold     | 1500 - 1999  |
| Platinum | 2000+        |

**Placement:** 10 matches before tier assignment

---

## Non-Functional Requirements

**Performance:** 60Hz game loop, <50ms WebSocket RTT, <100ms DB queries

**Security:** HTTPS only, HttpOnly cookies, TypeBox validation, CSRF protection,
rate limiting (100 req/min on auth)

**Compatibility:** Latest modern browsers (Chrome, Firefox, Safari, Edge),
1280×720 minimum resolution

**Deployment:** Single `docker compose up --build`, auto-migrations,
`/api/health` endpoint

---

## Out of Scope (v2.0)

Mobile app, tournaments, power-ups/items, voice chat, email auth, admin
dashboard, chat rooms, game replays, i18n

---

## Open Questions

| ID  | Question                         |
| :-- | :------------------------------- |
| Q1  | Ship customization (cosmetic)?   |
| Q2  | Player disconnect grace period?  |
| Q3  | Replay system for later release? |
| Q4  | Sound effects toggle?            |

---

## Definition of Done

- [ ] PR approved (1+ reviewer)
- [ ] Biome check passes
- [ ] TypeScript compiles (no `any` without justification)
- [ ] Rust compiles with no warnings
- [ ] Works in Docker container
- [ ] No console errors
- [ ] API docs updated if new endpoints
