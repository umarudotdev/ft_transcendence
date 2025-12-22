# Product Requirements

| Project          | Version | Status |
| :--------------- | :------ | :----- |
| ft_transcendence | 1.1     | Draft  |

---

## Executive Summary

Real-time Pong platform for 42 students with multiplayer gameplay, chat, and 2FA. Target: **14 points** using modern TypeScript stack.

## Success Metrics

| Metric           | Target               |
| :--------------- | :------------------- |
| Evaluation Score | >= 14 points         |
| Game Latency     | < 50ms local network |
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

| ID    | Story                                          | Priority   |
| :---- | :--------------------------------------------- | :--------- |
| US-07 | Matchmaking queue (30s timeout)                | Must Have  |
| US-08 | Play vs AI (100ms delay, ±20px error)          | Must Have  |
| US-09 | Responsive paddle controls (client prediction) | Must Have  |
| US-10 | Final score modal, first to 11 wins            | Must Have  |
| US-11 | Spectator mode                                 | Could Have |

### Social & Chat (Sprint 3-4)

| ID    | Story                          | Priority    |
| :---- | :----------------------------- | :---------- |
| US-12 | Direct messages (WebSocket)    | Should Have |
| US-13 | Block users                    | Should Have |
| US-14 | Invite friends to private game | Should Have |

---

## Game Specs

| Property      | Value                  |
| :------------ | :--------------------- |
| Canvas        | 800×600px (responsive) |
| Paddle        | 10×100px               |
| Ball          | 10×10px, 5-15 px/tick  |
| Win Condition | First to 11            |
| Tick Rate     | 60/second              |

**Network:** WebSocket at 60Hz. Client sends input, server broadcasts authoritative state.

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

### Game

| Method      | Path              | Description            |
| :---------- | :---------------- | :--------------------- |
| POST/DELETE | `/api/game/queue` | Join/leave matchmaking |
| POST        | `/api/game/ai`    | Start AI game          |
| WS          | `/api/game/ws`    | Game state WebSocket   |

### Social

| Method                | Path               | Description       |
| :-------------------- | :----------------- | :---------------- |
| GET/POST/PATCH/DELETE | `/api/friends/:id` | Friend management |
| POST/DELETE           | `/api/blocks/:id`  | Block management  |
| WS                    | `/api/chat/ws`     | Chat WebSocket    |

---

## Non-Functional Requirements

**Performance:** 60 ticks/s game loop, <50ms WebSocket RTT, <100ms DB queries

**Security:** HTTPS only, HttpOnly cookies, TypeBox validation, CSRF protection, rate limiting (100 req/min on auth)

**Compatibility:** Latest modern browsers (Chrome, Firefox, Safari, Edge), 1280×720 minimum resolution

**Deployment:** Single `docker compose up --build`, auto-migrations, `/api/health` endpoint

---

## Out of Scope

Mobile app, tournaments, power-ups, voice chat, leaderboards, email auth, admin dashboard, chat rooms, game replays, i18n

---

## Open Questions

| ID  | Question                     |
| :-- | :--------------------------- |
| Q1  | Keyboard AND mouse controls? |
| Q2  | Player disconnect handling?  |
| Q3  | Match history pagination?    |
| Q4  | Should blocked users know?   |
| Q5  | Game invite rate limiting?   |

---

## Definition of Done

- [ ] PR approved (1+ reviewer)
- [ ] Biome check passes
- [ ] TypeScript compiles (no `any` without justification)
- [ ] Works in Docker container
- [ ] No console errors
- [ ] API docs updated if new endpoints
