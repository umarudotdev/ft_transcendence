# Game Design Document

| Project          | Version | Status |
| :--------------- | :------ | :----- |
| ft_transcendence | 2.0     | Draft  |

---

## 1. Game Concept

**Genre:** Bullet hell / shoot 'em up (shmup) **Perspective:** Top-down (classic
vertical shmup style) **Core Loop:** Players control ships, shoot projectiles,
dodge enemy bullets, use abilities to survive and defeat opponents

### Target Experience

- Fast-paced, skill-based combat
- Satisfying bullet patterns and dodging
- Competitive ranked play with Elo matchmaking

---

## 2. Game Mode

**1v1 Ranked PvP** — Two players, last standing wins, Elo-rated.

## 3. Win Condition

**Last Standing** — 3 lives per player, last alive wins. Elo rating adjusts
based on outcome.

---

## 4. Player Mechanics

### 4.1 Movement

- **WASD / Arrow keys** for 8-directional movement
- **Focus mode (Shift):** Slower, precise movement with smaller hitbox visible
- Movement speed: Normal 300px/s, Focus 150px/s

### 4.2 Combat

| Action           | Input             | Cooldown | Description                     |
| ---------------- | ----------------- | -------- | ------------------------------- |
| **Primary Fire** | Hold Space / Auto | None     | Continuous projectile stream    |
| **Ability 1**    | Q                 | 8s       | Dash / Shield / Special shot    |
| **Ability 2**    | E                 | 12s      | AoE / Bomb / Utility            |
| **Ultimate**     | R                 | Charged  | Powerful screen-clearing attack |

### 4.3 Hitboxes

- **Ship visual:** 32x32 px
- **Actual hitbox:** 6x6 px centered (standard shmup design)
- Hitbox visible during focus mode

---

## 5. Bullet Patterns

### 5.1 Player Bullets

| Type     | Damage | Speed   | Spread         |
| -------- | ------ | ------- | -------------- |
| Standard | 10     | 600px/s | Single forward |
| Spread   | 6      | 500px/s | 3-way fan      |
| Laser    | 25     | Instant | Hitscan line   |

### 5.2 Enemy/AI Patterns

For PvE and AI opponent modes:

| Pattern          | Description                                |
| ---------------- | ------------------------------------------ |
| **Radial Burst** | Bullets spread in circle                   |
| **Aimed Shot**   | Tracks player position                     |
| **Stream**       | Continuous line of bullets                 |
| **Spiral**       | Rotating pattern                           |
| **Wall**         | Horizontal/vertical bullet walls with gaps |

---

## 6. Abilities

### 6.1 Active Abilities

| Ability        | Type      | Effect                                          |
| -------------- | --------- | ----------------------------------------------- |
| **Dash**       | Movement  | Invincible teleport 100px in movement direction |
| **Shield**     | Defensive | 2s bubble that blocks bullets                   |
| **Bomb**       | Offensive | Clear bullets in radius, damage enemies         |
| **Slow Field** | Utility   | Slow enemy bullets in area for 3s               |

### 6.2 Ultimate Abilities

| Ultimate         | Charge Requirement  | Effect                             |
| ---------------- | ------------------- | ---------------------------------- |
| **Hyper Beam**   | 60s of damage dealt | Massive laser for 3s               |
| **Bullet Time**  | 45s of survival     | Slow everything except self for 5s |
| **Mirror Force** | Taking 200 damage   | Reflect all bullets back           |

---

## 7. Ranked System

Uses existing Elo implementation with extensions:

| Tier     | Rating Range |
| -------- | ------------ |
| Bronze   | 0 - 999      |
| Silver   | 1000 - 1499  |
| Gold     | 1500 - 1999  |
| Platinum | 2000+        |

### Matchmaking

- Queue by rating band (+/- 200 initially, expands over time)
- Expected queue time: 30s - 2min
- Placement matches: 10 games before tier assignment

---

## 8. Game Specifications

| Property    | Value                        |
| ----------- | ---------------------------- |
| Canvas      | 800×600px (responsive)       |
| Player Ship | 32×32px visual, 6×6px hitbox |
| Tick Rate   | 60/second                    |
| Network     | WebSocket at 60Hz            |

---

## 9. Controls Summary

| Action     | Primary | Alternative      |
| ---------- | ------- | ---------------- |
| Move Up    | W       | Arrow Up         |
| Move Down  | S       | Arrow Down       |
| Move Left  | A       | Arrow Left       |
| Move Right | D       | Arrow Right      |
| Focus Mode | Shift   | -                |
| Fire       | Space   | Auto-fire option |
| Ability 1  | Q       | -                |
| Ability 2  | E       | -                |
| Ultimate   | R       | -                |

---

## 10. Future Considerations

- FFA mode (3-4 players, free-for-all)
- Co-op PvE mode (team vs AI wave patterns)
- Solo practice mode (single player vs AI, score attack)
- Score Attack / First to X Kills win conditions
- Ship customization (cosmetic)
- Tournament system
- Spectator mode
- Replay system
