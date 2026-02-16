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

- [ ] Colyseus game room with 60 ticks/s game loop
- [ ] Automatic state synchronization via Colyseus Schema
- [ ] Canvas rendering with client-side prediction
- [ ] Basic chat with direct messages

## Milestone 4: Features

**Goal:** All 14 points implemented.

- [ ] AI opponent with reaction delay
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
| Framework (Front + Back) | 2      | [ ]  |
| Server-Side Rendering    | 1      | [ ]  |
| ORM                      | 1      | [ ]  |
| Web-based Game           | 2      | [ ]  |
| Remote Players           | 2      | [ ]  |
| AI Opponent              | 2      | [ ]  |
| User Management          | 2      | [ ]  |
| Game Statistics          | 1      | [ ]  |
| 2FA                      | 1      | [ ]  |
| **Total**                | **14** |      |
