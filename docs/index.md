---
layout: home

hero:
  name: "ft_transcendence"
  text: "Real-time Pong Platform"
  tagline: Multiplayer gameplay, chat, and 2FA for the 42 curriculum
  actions:
    - theme: brand
      text: Get Started
      link: /architecture
    - theme: alt
      text: View PRD
      link: /prd

features:
  - title: Real-time Multiplayer
    details: WebSocket-based game engine running at 60 ticks/s with client-side prediction for smooth gameplay
  - title: Type-Safe Stack
    details: Bun + ElysiaJS + SvelteKit with Eden Treaty for end-to-end type safety between frontend and backend
  - title: Secure Auth
    details: 42 OAuth integration with database sessions and TOTP-based two-factor authentication
---

## Tech Stack

| Component | Technology                   |
| --------- | ---------------------------- |
| Runtime   | Bun                          |
| Backend   | ElysiaJS                     |
| Frontend  | SvelteKit (SSR)              |
| Database  | PostgreSQL + Drizzle ORM     |
| Styling   | Tailwind CSS + Shadcn-Svelte |
| Auth      | Arctic (OAuth) + Oslo (TOTP) |

## Quick Start

```bash
# Start the entire stack
docker compose up --build

# Or run locally
bun install
cd apps/api && bun run migrate
bun run dev
```

## Module Points (14 Total)

| Category  | Points | Modules                                               |
| --------- | ------ | ----------------------------------------------------- |
| Web       | 4      | Frontend + Backend Frameworks (2) + SSR (1) + ORM (1) |
| Gaming    | 6      | Web Game (2) + Remote Players (2) + AI Opponent (2)   |
| User Mgmt | 3      | Standard User Mgmt (2) + Game Stats (1)               |
| Security  | 1      | 2FA TOTP (1)                                          |
