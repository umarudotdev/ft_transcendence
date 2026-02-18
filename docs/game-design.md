# Game Design Document

| Project          | Version | Status      |
| :--------------- | :------ | :---------- |
| ft_transcendence | 3.0     | Implemented |

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
bullets. Density increases over time as players trade fire, creating a rising
pressure curve that serves Challenge and Sensation.

**Risk/reward tradeoff** — Focus mode halves speed but increases damage (15 vs 8
per bullet) and narrows to a single precise shot. Players must choose between
evasion ability and kill pressure. Serves Challenge.

**Resource management** — Dash (8s) and Bomb (12s) cooldowns force tactical
decisions. Dashing to dodge means losing your escape for 8 seconds. Serves
Challenge.

**Comeback potential** — 3 lives with 1.5s invincibility on respawn prevents
instant snowballing. Ultimate charge (built from damage dealt) gives the
aggressive player a finisher but requires risk to build. Serves Competition.

**Positive feedback concern** — The player landing more hits charges ultimate
faster, gaining more advantage. This resembles the Monopoly wealth-gap problem
described in the MDA paper. The lives + invincibility system partially
counteracts this, but tuning may be needed to ensure matches remain competitive
through all three lives.

### 2.3 Mechanics Summary

The mechanics layer is detailed in sections 4-8 below. Key systems:

- **Movement:** 300px/s normal, 150px/s focus, 3px hitbox radius
- **Fire modes:** 3-way spread (8dmg) vs focused single (15dmg)
- **Abilities:** Dash (teleport + invincibility), Bomb (AOE clear + 30dmg),
  Ultimate (large clear + 50dmg)
- **Health:** 100 HP, 3 lives, 1.5s invincibility on respawn
- **Collision:** Circle-circle detection at 60Hz server tick rate
- **Matchmaking:** Elo-based with expanding rating band (200 initial, +50/10s,
  cap 500)

### 2.4 Tuning Levers

These values can be adjusted to shift the dynamic balance:

| Parameter              | Current | Effect if increased                   |
| ---------------------- | ------- | ------------------------------------- |
| Lives                  | 3       | Longer matches, more comeback room    |
| HP per life            | 100     | Slower kills, more sustained pressure |
| Invincibility duration | 1.5s    | More breathing room after death       |
| Bomb radius            | 120px   | Safer defensive option                |
| Bomb cooldown          | 12s     | More frequent bullet clearing         |
| Ultimate charge rate   | 1/dmg   | Faster access to finisher             |
| Focus damage           | 15      | Higher reward for risky precision     |
| Spread damage          | 8       | Higher safe-play damage output        |

---

## 3. Design Influences

### 3.1 Data-Oriented Architecture

The game server's simulation layer follows data-oriented design principles
influenced by the Entity Component System (ECS) pattern (as formalized by
engines like Bevy). Game state is organized as plain data structures (Colyseus
schemas) processed by stateless system functions rather than object hierarchies
with virtual dispatch.

| ECS Concept    | Our Implementation                                         |
| -------------- | ---------------------------------------------------------- |
| **Entities**   | Players, Bullets, Effects (schema instances)               |
| **Components** | Schema fields: x, y, hp, lives, velocityX, ownerId         |
| **Systems**    | `movement.ts`, `combat.ts`, `collision.ts`, `abilities.ts` |

This separation means game logic is testable in isolation (57 unit tests run in
~50ms), systems can be reasoned about independently, and tuning a value in one
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

### 6.2 Combat

| Action           | Input | Cooldown                   | Description                             |
| ---------------- | ----- | -------------------------- | --------------------------------------- |
| **Primary Fire** | Space | 100ms focus / 300ms spread | Continuous projectile stream            |
| **Ability 1**    | Q     | 8s                         | Dash: teleport 100px + invincibility    |
| **Ability 2**    | E     | 12s                        | Bomb: clear bullets + 30 AOE damage     |
| **Ultimate**     | R     | 100 charge                 | Clear large radius + 50 damage to enemy |

### 6.3 Fire Modes

Fire mode depends on whether focus (Shift) is held:

| Mode        | Damage | Speed   | Pattern        | Cooldown |
| ----------- | ------ | ------- | -------------- | -------- |
| **Normal**  | 8      | 500px/s | 3-way spread   | 300ms    |
| **Focused** | 15     | 500px/s | Single forward | 100ms    |

Player 0 fires upward; Player 1 fires downward.

### 6.4 Hitboxes

- **Ship visual:** 32x32 px
- **Actual hitbox:** 3px radius (6x6 px equivalent), standard shmup design
- **Bullet hitbox:** 4px radius
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

| Property      | Value                              |
| ------------- | ---------------------------------- |
| Charge        | 100 points (1 per damage dealt)    |
| Bullet clear  | 200px radius                       |
| Damage        | 50 to all enemies (no range limit) |
| Visual effect | 1s ultimate explosion              |

### 7.4 Planned Abilities (not yet implemented)

| Ability          | Type      | Description                          |
| ---------------- | --------- | ------------------------------------ |
| **Shield**       | Defensive | 2s bubble that blocks bullets        |
| **Slow Field**   | Utility   | Slow enemy bullets in area for 3s    |
| **Hyper Beam**   | Ultimate  | Massive laser for 3s                 |
| **Bullet Time**  | Ultimate  | Slow everything except self for 5s   |
| **Mirror Force** | Ultimate  | Reflect all bullets back at opponent |

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

| Action     | Primary | Alternative |
| ---------- | ------- | ----------- |
| Move Up    | W       | Arrow Up    |
| Move Down  | S       | Arrow Down  |
| Move Left  | A       | Arrow Left  |
| Move Right | D       | Arrow Right |
| Focus Mode | Shift   | -           |
| Fire       | Space   | -           |
| Ability 1  | Q       | -           |
| Ability 2  | E       | -           |
| Ultimate   | R       | -           |

---

## 12. Future Considerations

- AI opponent (required for 42 evaluation)
- Enemy/AI bullet patterns (radial burst, aimed shot, spiral, wall)
- FFA mode (3-4 players, free-for-all)
- Co-op PvE mode (team vs AI wave patterns)
- Solo practice mode (single player vs AI, score attack)
- Additional win conditions (Score Attack, First to X Kills)
- Ship customization (cosmetic)
- Tournament system
- Spectator mode
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
