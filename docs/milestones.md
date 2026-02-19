# Milestones

## Milestone 1: Setup

**Goal:** Docker builds in one command, frontend and backend communicate with
type safety.

- [x] Initialize monorepo with Bun workspaces
- [ ] Create ElysiaJS backend with health endpoint
- [ ] Create SvelteKit frontend with Tailwind + Shadcn-Svelte
- [ ] Set up PostgreSQL with Drizzle ORM schema
- [ ] Configure Docker Compose (Nginx + Frontend + Backend + PostgreSQL)
- [ ] Set up Eden Treaty for type-safe API calls
- [ ] Configure Biome + Prettier + Lefthook

## Milestone 2: Auth

**Goal:** Users can log in with 42 OAuth and access protected routes.

- [ ] Create users and sessions tables (Drizzle schema)
- [ ] Implement 42 OAuth flow with Arctic
- [ ] Create session management (create, validate, delete)
- [ ] Add auth endpoints (login, logout, me)
- [ ] Build login page with 42 OAuth button
- [ ] Create basic layout with navigation
- [ ] Add auth guard for protected routes

## Milestone 3: Real-Time

**Goal:** Two players can play a bullet hell match on different computers.

- [x] Colyseus game room with 60 ticks/s game loop
- [x] Automatic state synchronization via Colyseus Schema (20Hz patches)
- [x] Canvas rendering with interpolation (100ms delay buffer)
- [x] Basic chat with direct messages

## Milestone 3.5: Game Polish

**Goal:** Deep, visually compelling gameplay with multiple skill axes.

- [x] Bug fixes: dash boundary clamping, isDashing persistence, ultimate range
- [x] Server-authoritative mouse aim (aimAngle)
- [x] Angular velocity on spread bullets (curving patterns)
- [x] Graze mechanic (anti-snowball ultimate charge)
- [x] Additive glow rendering with pre-rendered gradient stamps
- [x] Client-side particle system (1024-pool, ring-buffer)
- [x] Bullet visual differentiation (spread circles vs focus lines)
- [x] Opponent ability cooldown HUD indicators
- [x] 70 game server tests, 103 web tests passing

## Milestone 4: Features

**Goal:** All 14 points implemented.

- [ ] Matchmaking queue
- [ ] Profile editing and avatar upload
- [ ] Friend system and user blocking
- [ ] Match history and stats
- [ ] 2FA via TOTP

## Milestone 5: Polish

**Goal:** Zero bugs, ready for defense.

- [ ] Responsive design and error handling
- [ ] Privacy Policy and Terms of Service pages
- [ ] Security audit (SQL injection, XSS, auth bypass)
- [ ] Mock evaluation practice

---

## Point Tracking

| Module                   | Points | Done |
| :----------------------- | :----- | :--- |
| Framework (Front + Back) | 2      | [x]  |
| Server-Side Rendering    | 1      | [x]  |
| ORM                      | 1      | [x]  |
| Web-based Game           | 2      | [x]  |
| Remote Players           | 2      | [x]  |
| User Management          | 2      | [ ]  |
| Game Statistics          | 1      | [ ]  |
| 2FA                      | 1      | [ ]  |
| **Total**                | **12** |      |
