# SuperCluster Networking Architecture

This document describes the client-server networking architecture for SuperCluster multiplayer gameplay.

---

## Overview

SuperCluster uses **Client-side Prediction with Server Reconciliation** - the industry standard for real-time action games. This provides responsive controls while maintaining server authority for anti-cheat and consistency.

### Key Principles

1. **Server is authoritative** - Server's game state is the "truth"
2. **Client predicts locally** - Immediate visual feedback, no input lag
3. **Server overwrites client** - Client always accepts server state
4. **Inputs are validated** - Server checks for impossible actions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHARED CODE                                       │
│              (packages/supercluster/src/engine/)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  - Physics simulation (movement on sphere)                               │
│  - Collision detection                                                   │
│  - Input processing                                                      │
│  - Game rules                                                            │
│                                                                          │
│  Used by BOTH client (prediction) and server (authoritative)             │
└─────────────────────────────────────────────────────────────────────────┘
              │                                         │
              ▼                                         ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│        CLIENT           │              │        SERVER           │
│      (apps/web)         │              │       (apps/api)        │
├─────────────────────────┤              ├─────────────────────────┤
│                         │    Input     │                         │
│  - Input capture        │ ───────────► │  - Authoritative state  │
│  - Three.js renderer    │   (WebSocket)│  - Input validation     │
│  - Local prediction     │              │  - Game loop (60 Hz)    │
│  - State interpolation  │    State     │  - Broadcast to clients │
│                         │ ◄─────────── │  - Anti-cheat checks    │
│                         │   (WebSocket)│                         │
└─────────────────────────┘              └─────────────────────────┘
```

---

## Data Flow

### 1. Player Input

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT                                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Player presses W key                                                    │
│       │                                                                  │
│       ├──► Store input with sequence number                              │
│       │    inputBuffer.push({ seq: 1234, keys: {...}, aimAngle: 1.57 }) │
│       │                                                                  │
│       ├──► Send to server immediately                                    │
│       │    ws.send({ type: "input", sequence: 1234, ... })              │
│       │                                                                  │
│       └──► Apply locally (PREDICTION)                                    │
│            - Update ship position                                        │
│            - Rotate planet                                               │
│            - Visual feedback is INSTANT                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Server Processing

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER                                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Receive input from client                                               │
│       │                                                                  │
│       ├──► Validate input                                                │
│       │    - Is movement speed reasonable?                               │
│       │    - Is fire rate within limits?                                 │
│       │    - Is timestamp reasonable?                                    │
│       │                                                                  │
│       ├──► Apply to authoritative game state                             │
│       │    - Update ship position                                        │
│       │    - Process shooting                                            │
│       │    - Check collisions                                            │
│       │                                                                  │
│       └──► Include in next state broadcast                               │
│            - Attach last processed sequence number                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. State Broadcast

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER (every tick - 60 Hz)                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  For each connected client:                                              │
│       │                                                                  │
│       └──► Send game state                                               │
│            {                                                             │
│                type: "state",                                            │
│                tick: 5678,                                               │
│                lastProcessedInput: 1234,  // For reconciliation         │
│                players: { ... },                                         │
│                projectiles: [ ... ],                                     │
│                enemies: [ ... ]           // Co-op mode                  │
│            }                                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4. Client Reconciliation

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT                                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Receive server state (lastProcessedInput: 1234)                         │
│       │                                                                  │
│       ├──► ALWAYS accept server state as truth                           │
│       │    localState = serverState                                      │
│       │                                                                  │
│       ├──► Remove acknowledged inputs from buffer                        │
│       │    inputBuffer = inputBuffer.filter(i => i.seq > 1234)          │
│       │                                                                  │
│       └──► Re-apply unacknowledged inputs (prediction)                   │
│            for (input of inputBuffer) {                                  │
│                applyInput(localState, input)                             │
│            }                                                             │
│                                                                          │
│  Result: Client shows predicted state, but server state is foundation    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Message Formats

### Client → Server: Input Message

```typescript
interface InputMessage {
    type: 'input';
    sequence: number;           // Incrementing ID for reconciliation
    timestamp: number;          // Client timestamp (for validation)
    keys: {
        forward: boolean;
        backward: boolean;
        left: boolean;
        right: boolean;
    };
    aimAngle: number;           // Radians, where aim dot points
    shoot: boolean;             // Fire button pressed this frame
}
```

### Server → Client: State Message

```typescript
interface StateMessage {
    type: 'state';
    tick: number;                       // Server tick number
    lastProcessedInput: number;         // Last input sequence processed

    players: {
        [playerId: string]: {
            position: {
                phi: number;            // Spherical coordinate
                theta: number;          // Spherical coordinate
            };
            directionAngle: number;     // Where ship tip points
            aimAngle: number;           // Where aim dot is
            lives: number;
            invincible: boolean;
            score: number;              // For 1v1
        };
    };

    projectiles: Array<{
        id: number;
        ownerId: string;                // Who fired it
        position: { phi: number; theta: number };
        direction: number;              // Movement direction
        age: number;                    // Ticks since spawn
    }>;

    // Co-op mode only
    enemies?: Array<{
        id: number;
        type: 'asteroid' | 'chaser' | 'shooter';
        position: { phi: number; theta: number };
        health: number;
        velocity: { phi: number; theta: number };
    }>;

    // Shared state
    wave?: number;                      // Co-op wave number
    sharedScore?: number;               // Co-op shared score
    gameStatus: 'waiting' | 'countdown' | 'playing' | 'paused' | 'gameOver';
}
```

---

## Tick Rate and Network Rate

### Tick Rate: 60 Hz (Server)

The server updates game state 60 times per second:

```
Tick 1 → Tick 2 → Tick 3 → Tick 4 → ...
  16ms    16ms    16ms    16ms
```

Each tick:
1. Process received inputs
2. Update physics (movement, projectiles)
3. Check collisions
4. Broadcast state to all clients

### Network Rate: 60 Hz

State is sent every tick (60 packets/second per client).

For 1v1, this is fine:
- 2 players × 60 packets/second = 120 packets/second total
- Each state message ~500-1000 bytes
- Total bandwidth: ~60-120 KB/second (minimal)

### Client Render Rate: 60+ fps

Client renders at monitor refresh rate (typically 60-144 fps).

Since network rate = tick rate, no interpolation needed between server states.

---

## Interpolation

When client receives server state, it may differ slightly from predicted state due to:
- Network latency variations
- Floating point differences
- Server corrections

### Smooth Correction

Instead of snapping instantly (jarring), interpolate over ~100ms:

```typescript
// On receiving server state
const correctionDuration = 100; // ms
const correctionStart = performance.now();
const startPosition = currentPosition.clone();
const targetPosition = serverState.position;

// Each frame during correction
function update() {
    const elapsed = performance.now() - correctionStart;
    const t = Math.min(elapsed / correctionDuration, 1);

    // Smooth interpolation
    currentPosition.lerpVectors(startPosition, targetPosition, smoothstep(t));

    if (t < 1) {
        // Still correcting, re-apply unacknowledged inputs on top
        for (const input of inputBuffer) {
            applyInput(currentPosition, input);
        }
    }
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
```

### When to Snap vs Interpolate

| Difference | Action |
|------------|--------|
| Small (< 5 units) | Interpolate smoothly |
| Large (> 20 units) | Snap immediately (likely teleport/respawn) |
| Medium | Interpolate faster (~50ms) |

---

## Anti-Cheat Validation

Server validates all inputs before processing:

### Movement Validation

```typescript
function validateMovement(
    input: InputMessage,
    lastInput: InputMessage,
    currentState: PlayerState
): boolean {
    // Time between inputs
    const timeDelta = input.timestamp - lastInput.timestamp;

    // Too fast? (speedhack detection)
    if (timeDelta < 10) { // < 10ms between inputs
        console.warn('Input too fast, possible speedhack');
        return false;
    }

    // Calculate maximum possible movement
    const maxMove = SHIP_SPEED * timeDelta * 1.5; // 50% tolerance

    // Compare with actual claimed movement
    // (Position is calculated server-side, but validate timing)

    return true;
}
```

### Fire Rate Validation

```typescript
function validateShoot(
    input: InputMessage,
    lastShootTime: number
): boolean {
    const timeSinceLastShot = input.timestamp - lastShootTime;

    // Minimum time between shots (e.g., 200ms)
    if (timeSinceLastShot < MIN_SHOOT_INTERVAL) {
        console.warn('Shooting too fast');
        return false;
    }

    return true;
}
```

### Position Sanity Check

```typescript
function validatePosition(position: SphericalPosition): boolean {
    // Phi must be 0 to PI
    if (position.phi < 0 || position.phi > Math.PI) {
        return false;
    }

    // Theta must be 0 to 2*PI
    if (position.theta < 0 || position.theta > Math.PI * 2) {
        return false;
    }

    return true;
}
```

---

## Game Modes

### 1v1 Mode

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1v1 MODE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Players: 2                                                              │
│  Objective: Shoot opponent, avoid being shot                             │
│                                                                          │
│  State includes:                                                         │
│  - Both players' ships                                                   │
│  - All projectiles                                                       │
│  - Per-player score                                                      │
│                                                                          │
│  Collision detection:                                                    │
│  - Projectile vs opponent ship                                           │
│  - Ship vs ship (optional bump)                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Co-op Mode

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CO-OP MODE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Players: 2                                                              │
│  Objective: Survive waves of enemies together                            │
│                                                                          │
│  State includes:                                                         │
│  - Both players' ships                                                   │
│  - All projectiles                                                       │
│  - All enemies (asteroids, chasers, shooters)                            │
│  - Shared score                                                          │
│  - Wave number                                                           │
│                                                                          │
│  Collision detection:                                                    │
│  - Projectile vs enemy                                                   │
│  - Enemy vs player ship                                                  │
│  - Friendly fire? (configurable)                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Connection Handling

### Connection States

```typescript
type ConnectionState =
    | 'connecting'      // WebSocket opening
    | 'connected'       // Ready to play
    | 'reconnecting'    // Lost connection, trying to restore
    | 'disconnected';   // Fully disconnected
```

### Reconnection Flow

```
Connection lost
      │
      ▼
Show "Reconnecting..." overlay
      │
      ▼
Attempt reconnect (max 5 tries, 2s apart)
      │
      ├── Success: Resume game, request full state
      │
      └── Failure: Show "Disconnected" screen
```

### Latency Handling

```typescript
// Measure round-trip time
function measureLatency() {
    const pingTime = performance.now();
    ws.send({ type: 'ping', timestamp: pingTime });
}

// On pong response
function onPong(pongTime: number) {
    const latency = performance.now() - pongTime;
    latencyHistory.push(latency);

    // Keep last 10 measurements
    if (latencyHistory.length > 10) {
        latencyHistory.shift();
    }

    // Average latency
    averageLatency = latencyHistory.reduce((a, b) => a + b) / latencyHistory.length;
}
```

### Latency Display

Show connection quality indicator:

| Latency | Quality | Color |
|---------|---------|-------|
| < 50ms | Excellent | Green |
| 50-100ms | Good | Yellow |
| 100-200ms | Fair | Orange |
| > 200ms | Poor | Red |

---

## Implementation Checklist

### Shared Package (packages/supercluster)

- [ ] Game engine (physics, collision)
- [ ] Input processing logic
- [ ] State types and interfaces
- [ ] Coordinate conversion utilities

### Server (apps/api)

- [ ] WebSocket endpoint for game rooms
- [ ] Game loop (60 Hz tick)
- [ ] Input validation
- [ ] State broadcast
- [ ] Room management (create, join, leave)
- [ ] Anti-cheat checks

### Client (apps/web)

- [ ] Input buffer for reconciliation
- [ ] Prediction using shared engine
- [ ] State interpolation
- [ ] Reconnection handling
- [ ] Latency display

---

## References

- [Gabriel Gambetta: Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Valve: Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
- [Glenn Fiedler: Networked Physics](https://gafferongames.com/post/introduction_to_networked_physics/)
