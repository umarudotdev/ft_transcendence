# Game Design Document

| Project          | Version | Status      |
| :--------------- | :------ | :---------- |
| ft_transcendence | 4.0     | Implemented |

---

## 1. Game Concept

**Genre:** Bullet hell / shoot 'em up (shmup)
**Perspective:** Top-down vertical shmup
**Core Loop:** Players control ships, shoot projectiles, dodge enemy bullets, use
abilities to survive and defeat opponents

---

## 2. Design Framework (MDA)

This game's design is analyzed through the MDA framework (Hunicke, LeBlanc,
Zubek 2004) — Mechanics, Dynamics, Aesthetics. Designers control Mechanics;
Dynamics emerge at runtime; Aesthetics are the player's emotional experience.

### 2.1 Target Aesthetics

| Aesthetic       | Priority  | Description                                      |
| --------------- | --------- | ------------------------------------------------ |
| **Challenge**   | Primary   | Precision dodging, aim skill, ability timing     |
| **Competition** | Primary   | 1v1 ranked play, Elo ratings, leaderboard        |
| **Sensation**   | Secondary | Bullet density, visual effects, screen spectacle |
| **Fantasy**     | Tertiary  | Powerful ship with special abilities             |
| **Submission**  | Tertiary  | Quick matches (~2-3 min), low barrier to entry   |

### 2.2 Dynamic Models

The following dynamics emerge from our mechanics and serve the target
aesthetics:

**Escalating tension** — Both players fire continuously, filling the screen with
bullets. Spread bullets curve via angular velocity, creating fanning patterns
that increase density over time. This rising pressure curve serves Challenge and
Sensation.

**Risk/reward tradeoff** — Focus mode halves speed but increases damage (15 vs 8
per bullet) and narrows to a single precise shot. Players must choose between
evasion ability and kill pressure. Serves Challenge.

**Resource management** — Dash (8s) and Bomb (12s) cooldowns force tactical
decisions. Dashing to dodge means losing your escape for 8 seconds. Serves
Challenge.

**Comeback potential** — 3 lives with 1.5s invincibility on respawn prevents
instant snowballing. The graze mechanic charges ultimate for the player under
fire (2 charge per near-miss), counteracting the attacker's advantage. Serves
Competition.

**Graze risk/reward** — Bullet grazing rewards brave positioning (standing close
to bullet paths) with ultimate charge. Each bullet can only graze a player once.
This creates a second axis of skill: not just dodging, but dodging _closely_.
Serves Challenge.

**Positive feedback mitigation** — The player landing more hits charges ultimate
faster, but the graze mechanic gives the defender a parallel charge path. This
two-way charge system (attacker via hits, defender via grazes) prevents the
Monopoly wealth-gap problem described in the MDA paper.

### 2.3 Mechanics Summary

The mechanics layer is detailed in sections 4-8 below. Key systems:

- **Movement:** 300px/s normal, 150px/s focus, 3px hitbox radius
- **Aim:** Server-authoritative mouse cursor aiming (aimAngle via atan2)
- **Fire modes:** 3-way spread (8dmg, curving via angular velocity) vs focused
  single (15dmg, straight)
- **Abilities:** Dash (teleport + invincibility), Bomb (AOE clear + 30dmg),
  Ultimate (large clear + 50dmg within 200px)
- **Health:** 100 HP, 3 lives, 1.5s invincibility on respawn
- **Graze:** 20px near-miss radius, charges ultimate by 2 per graze
- **Collision:** Circle-circle detection at 60Hz server tick rate
- **Matchmaking:** Elo-based with expanding rating band (200 initial, +50/10s,
  cap 500)

### 2.4 Tuning Levers

These values can be adjusted to shift the dynamic balance:

| Parameter              | Current | Effect if increased                    |
| ---------------------- | ------- | -------------------------------------- |
| Lives                  | 3       | Longer matches, more comeback room     |
| HP per life            | 100     | Slower kills, more sustained pressure  |
| Invincibility duration | 1.5s    | More breathing room after death        |
| Bomb radius            | 120px   | Safer defensive option                 |
| Bomb cooldown          | 12s     | More frequent bullet clearing          |
| Ultimate charge rate   | 1/dmg   | Faster access to finisher              |
| Graze charge           | 2       | More comeback potential for defender   |
| Graze radius           | 20px    | Wider = easier grazing, more ult gain  |
| Angular velocity       | 1.2     | Spread bullets curve more aggressively |
| Focus damage           | 15      | Higher reward for risky precision      |
| Spread damage          | 8       | Higher safe-play damage output         |

---

## 3. Design Influences

### 3.1 Data-Oriented Architecture

The game server's simulation layer follows data-oriented design principles
influenced by the Entity Component System (ECS) pattern (as formalized by
engines like Bevy). Game state is organized as plain data structures (Colyseus
schemas) processed by stateless system functions rather than object hierarchies
with virtual dispatch.

| ECS Concept    | Our Implementation                                                   |
| -------------- | -------------------------------------------------------------------- |
| **Entities**   | Players, Bullets, Effects (schema instances)                         |
| **Components** | Schema fields: x, y, hp, lives, velocityX, aimAngle, angularVelocity |
| **Systems**    | `movement.ts`, `combat.ts`, `collision.ts`, `abilities.ts`           |

This separation means game logic is testable in isolation (70 unit tests run in
~500ms), systems can be reasoned about independently, and tuning a value in one
system has predictable effects on others.

Casey Muratori's critique of "Clean Code" patterns demonstrates that organizing
code by operation rather than by type reveals optimization opportunities and
avoids the performance cost of polymorphic dispatch. Our systems follow this
principle: `checkCollisions()` iterates all bullets against all players in a
tight loop rather than asking each entity to "check itself." With ~200 bullets
at peak, brute-force iteration (~400 checks/tick) outperforms any spatial
data structure at this scale.

### 3.2 Mechanics as Discovery

Jonathan Blow's design philosophy treats games as systems that generate answers
to questions the designer feeds into them. Rather than scripting specific player
experiences, the designer builds mechanics and observes what dynamics emerge.

This connects directly to MDA: we define mechanics (section 2.3), but the
dynamics (section 2.2) are predictions that must be validated through
playtesting. The "positive feedback concern" (ultimate charge rewarding the
winning player) was identified by reasoning about mechanics through this lens —
not by observing it in play.

Blow's "Preventing the Collapse of Civilization" talk argues that abstraction
layers accumulate and degrade over time. For our game server, this motivates
keeping the simulation layer thin: four system files with no framework
dependencies beyond Colyseus schemas. If Colyseus were replaced, the core game
logic (combat, collision, movement, abilities) would transfer with minimal
changes.

### 3.3 Practical Constraints

These influences are tempered by project realities:

- **TypeScript + Colyseus** was chosen for development speed, built-in state
  sync, and reconnection handling (ADR 0011). A Rust/Bevy server would gain
  cache-optimized storage and true parallel systems but lose Colyseus's
  networking layer.
- **60Hz with ~200 entities** is well within JavaScript's performance envelope.
  Data-oriented structure matters more at scale (thousands of entities, complex
  spatial queries). At our scale, the benefit is architectural clarity, not raw
  throughput.
- **The simulation is separable.** The four system files depend only on schema
  types and config constants. A future port to a native runtime (Rust, Zig, or
  Jai) would rewrite these ~400 lines while keeping the Colyseus networking
  layer or replacing it independently.

---

## 4. Game Mode

**1v1 Ranked PvP** — Two players, last standing wins, Elo-rated.

## 5. Win Condition

**Last Standing** — 3 lives per player, last alive wins. Elo rating adjusts
based on outcome.

---

## 6. Player Mechanics

### 6.1 Movement

- **WASD / Arrow keys** for 8-directional movement
- **Focus mode (Shift):** Slower, precise movement; hitbox visible
- Movement speed: Normal 300px/s, Focus 150px/s
- Player clamped to canvas bounds (16px margin)

### 6.2 Aim

Players aim with the mouse cursor. The aim angle is computed client-side as
`atan2(dx, -dy)` from the player position to the cursor in canvas space, then
sent to the server with each input update. The server applies this angle
authoritatively — ships rotate to face the aim direction, and all bullets fire
along the aim vector.

### 6.3 Combat

| Action           | Input | Cooldown                   | Description                             |
| ---------------- | ----- | -------------------------- | --------------------------------------- |
| **Primary Fire** | Space | 100ms focus / 300ms spread | Continuous projectile stream            |
| **Ability 1**    | Q     | 8s                         | Dash: teleport 100px + invincibility    |
| **Ability 2**    | E     | 12s                        | Bomb: clear bullets + 30 AOE damage     |
| **Ultimate**     | R     | 100 charge                 | Clear 200px radius + 50 damage in range |

### 6.4 Fire Modes

Fire mode depends on whether focus (Shift) is held:

| Mode        | Damage | Speed   | Pattern                 | Cooldown | Angular Velocity |
| ----------- | ------ | ------- | ----------------------- | -------- | ---------------- |
| **Normal**  | 8      | 500px/s | 3-way spread (curving)  | 300ms    | ±1.2 rad/s       |
| **Focused** | 15     | 500px/s | Single aimed (straight) | 100ms    | 0                |

Spread bullets curve outward: the left bullet has negative angular velocity, the
right has positive, and the center fires straight. This creates fanning patterns
that cover more area over time. Focus bullets travel in a straight line along
the aim direction.

### 6.5 Hitboxes

- **Ship visual:** 32x32 px
- **Actual hitbox:** 3px radius (6x6 px equivalent), standard shmup design
- **Bullet hitbox:** 4px radius
- **Graze radius:** 20px (near-miss detection)
- Combined collision radius: 7px (circle-circle detection)
- Hitbox visible during focus mode

---

## 7. Abilities

### 7.1 Dash (Slot 1, Q key)

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| Cooldown      | 8 seconds (480 ticks)                          |
| Distance      | 100px in movement direction                    |
| Default       | Forward if stationary (up for P1, down for P2) |
| Invincibility | 0.2 seconds after dash                         |

### 7.2 Bomb (Slot 2, E key)

| Property      | Value                           |
| ------------- | ------------------------------- |
| Cooldown      | 12 seconds (720 ticks)          |
| Blast radius  | 120px                           |
| Damage        | 30 to enemies in radius         |
| Bullet clear  | All enemy bullets within radius |
| Visual effect | 0.5s bomb explosion             |

### 7.3 Ultimate (Slot 3, R key)

| Property      | Value                                        |
| ------------- | -------------------------------------------- |
| Charge        | 100 points (1 per damage dealt, 2 per graze) |
| Bullet clear  | 200px radius                                 |
| Damage        | 50 to enemies within 200px                   |
| Visual effect | 1s ultimate explosion                        |

### 7.4 Graze

| Property         | Value                                            |
| ---------------- | ------------------------------------------------ |
| Graze radius     | 20px from player center                          |
| Charge per graze | 2 ultimate charge                                |
| Limit            | Each bullet can only graze a player once         |
| Invincible graze | Players can graze while invincible (after death) |

Grazing rewards precise positioning near bullet paths. It serves as an
anti-snowball mechanic: the player under fire builds ultimate charge by
narrowly dodging, counterbalancing the attacker's charge from landing hits.

---

## 8. Health & Lives

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| HP per life            | 100                                 |
| Lives                  | 3                                   |
| Invincibility on death | 1.5 seconds (90 ticks)              |
| Respawn behavior       | HP reset to 100, position unchanged |

---

## 9. Ranked System

Uses existing Elo implementation from the rankings module:

| Tier     | Rating Range |
| -------- | ------------ |
| Bronze   | 0 - 999      |
| Silver   | 1000 - 1499  |
| Gold     | 1500 - 1999  |
| Platinum | 2000+        |

### Matchmaking

- In-memory queue with Elo-based pairing
- Rating band: ±200 initially, expands +50 every 10s, caps at ±500
- Pairing loop runs every 2 seconds
- Mode filtering: ranked and casual queues are separate
- DB persistence for crash recovery (fire-and-forget writes)

---

## 10. Game Specifications

| Property         | Value                             |
| ---------------- | --------------------------------- |
| Canvas           | 800×600px                         |
| Player ship      | 32×32px visual, 3px radius hitbox |
| Tick rate        | 60/second (server-authoritative)  |
| Network          | Colyseus WebSocket                |
| Max players      | 2 per room                        |
| Reconnect window | 30 seconds                        |

### Game Phases

| Phase       | Description                                    |
| ----------- | ---------------------------------------------- |
| `waiting`   | Room created, waiting for both players to join |
| `countdown` | Both ready, 3-2-1 countdown                    |
| `playing`   | Game loop active, 60Hz simulation              |
| `finished`  | Win condition met, results recorded            |
| `abandoned` | Both disconnected or stale session             |

---

## 11. Controls Summary

| Action     | Primary    | Alternative |
| ---------- | ---------- | ----------- |
| Move Up    | W          | Arrow Up    |
| Move Down  | S          | Arrow Down  |
| Move Left  | A          | Arrow Left  |
| Move Right | D          | Arrow Right |
| Aim        | Mouse Move | -           |
| Focus Mode | Shift      | -           |
| Fire       | Space      | -           |
| Ability 1  | Q          | -           |
| Ability 2  | E          | -           |
| Ultimate   | R          | -           |

---

## 12. Visual Systems

### 12.1 Bullet Rendering

Bullets are visually differentiated by fire mode:

- **Spread bullets:** Small circles with additive glow
- **Focus bullets:** Elongated lines oriented to velocity, brighter glow

All bullets use additive blending (`globalCompositeOperation: 'lighter'`) with
pre-rendered radial gradient stamps for glow effects. Bullets are batched by
owner (player 1 vs player 2) to minimize `fillStyle` changes.

### 12.2 Particle System

Client-side particle pool (1024 particles, ring-buffer allocation) with emitters
for: bullet hits (8 particles), player death (32 + 12 white core), dash trail
(12), bomb explosion (24), ultimate burst (40 + 16 flash), and graze sparks (4).
All particles render with additive blending. No server sync — purely cosmetic.

### 12.3 Ship Rendering

Ships are triangles rotated to face `aimAngle` in local coordinate space. Engine
glow animates with `sin(tick * 0.3)`. Invincible players flash (visible every
other 4-tick window). Focus mode shows a small hitbox indicator. Shield draws
a circle around the ship.

---

## 13. Future Considerations

- Sound effects (Web Audio API, client-only)
- Post-match stats (bullets fired, hit rate, grazes, damage)
- Spectator mode (Colyseus native, non-player client)
- FFA mode (3-4 players, free-for-all)
- Ship customization (cosmetic)
- Tournament system
- Replay system

---

## References

- Hunicke, R., LeBlanc, M., Zubek, R. (2004). "MDA: A Formal Approach to Game
  Design and Game Research." GDC Game Design and Tuning Workshop.
  https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- Muratori, C. (2014-present). "Handmade Hero." https://handmadehero.org/
- Muratori, C. (2023). "Clean Code, Horrible Performance."
  https://www.computerenhance.com/p/clean-code-horrible-performance
- Blow, J. (2019). "Preventing the Collapse of Civilization." DevGAMM Moscow.
- Blow, J. (2008). "Braid" — design philosophy of feeding questions into
  systems and listening to the answers.
- Bevy Engine. "Introducing Bevy." https://bevy.org/news/introducing-bevy/ —
  ECS architecture reference for data-oriented game design.
