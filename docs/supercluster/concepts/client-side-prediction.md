# Client-Side Prediction and Server Reconciliation

This document explains how networked games achieve responsive gameplay despite network latency.

**References:**

- [Gabriel Gambetta: Client-Side Prediction and Server Reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [CrystalOrb - Rust netcode library](https://github.com/ErnWong/crystalorb)

---

## The Problem: Network Latency

In a server-authoritative game, the naive approach creates noticeable delay:

```
┌─────────┐                                    ┌─────────┐
│ Client  │                                    │ Server  │
│         │                                    │         │
│ Press W │                                    │         │
│    │    │ ─────── 50ms network ──────────►  │         │
│    │    │                                    │ Process │
│    │    │                                    │ input   │
│    │    │ ◄────── 50ms network ───────────  │ Send    │
│    │    │                                    │ state   │
│    ▼    │                                    │         │
│ Ship    │  Total: 100ms+ delay               │         │
│ moves   │  (unplayable at high ping)         │         │
└─────────┘                                    └─────────┘
```

**Problem:** Player presses W, waits 100ms+ to see ship move. Feels laggy.

---

## The Solution: Client-Side Prediction

The client doesn't wait for the server. It predicts what will happen:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT-SIDE PREDICTION                           │
│                                                                          │
│  1. Player presses W                                                     │
│                                                                          │
│  2. Client IMMEDIATELY applies input locally:                            │
│     localShip.position += velocity                                       │
│     (Player sees ship move instantly!)                                   │
│                                                                          │
│  3. Client sends input to server (in background)                         │
│                                                                          │
│  4. Server processes, sends authoritative state back                     │
│                                                                          │
│  5. Client reconciles (more on this below)                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Result:** Player sees immediate response. Server remains authoritative.

---

## How It Works: Sequence Numbers

The key insight: client and server need to agree on which inputs have been processed.

### Client Side

```typescript
// Client maintains:
let nextSeq = 1;                        // Next sequence number to assign
const pendingInputs: PlayerInput[] = []; // Inputs server hasn't acknowledged

function sendInput(keys: InputState) {
  const input: PlayerInput = {
    type: "input",
    seq: nextSeq++,        // Unique ID: 1, 2, 3, 4...
    tick: clientTick,      // When this input was made
    keys
  };

  // 1. Store locally (for reconciliation later)
  pendingInputs.push(input);

  // 2. Send to server
  ws.send(JSON.stringify(input));

  // 3. Apply immediately (PREDICTION - no waiting!)
  applyInputToLocalState(input);
}
```

### Server Side

```typescript
// Server tracks per-player:
const playerStates: Map<playerId, {
  state: ShipState,
  lastInputSeq: number
}>;

function onPlayerInput(playerId: string, input: PlayerInput) {
  const player = playerStates.get(playerId);

  // Apply input to authoritative state
  applyInput(player.state, input);

  // Track which input we processed
  player.lastInputSeq = input.seq;
}

// Every tick, broadcast state to all players
function broadcastState() {
  for (const [playerId, player] of playerStates) {
    const msg: StateMessage = {
      type: "state",
      state: gameState,
      lastInputSeq: player.lastInputSeq  // "I processed up to this"
    };
    sendToPlayer(playerId, msg);
  }
}
```

---

## Server Reconciliation

When the client receives server state, it must **reconcile**:

```typescript
function onServerState(msg: StateMessage) {
  // 1. Accept server's authoritative state
  //    (Server is always right!)
  localState = msg.state;

  // 2. Discard inputs server has already processed
  //    (They're baked into the state we just received)
  pendingInputs = pendingInputs.filter(input =>
    input.seq > msg.lastInputSeq
  );

  // 3. Re-apply inputs server hasn't seen yet
  //    (These are "in flight" - sent but not acknowledged)
  for (const input of pendingInputs) {
    applyInputToLocalState(input);
  }
}
```

### Visual Example

```
Time ──────────────────────────────────────────────────────────────────►

Client sends inputs:    seq=1    seq=2    seq=3    seq=4    seq=5
                          │        │        │        │        │
                          ▼        ▼        ▼        ▼        ▼
pendingInputs:         [1]     [1,2]   [1,2,3] [1,2,3,4] [1,2,3,4,5]

                                           │
                                    Network delay...
                                           │
                                           ▼
Server processes:                      seq=1,2,3
Server sends:                          state + lastInputSeq=3
                                           │
                                    Network delay...
                                           │
                                           ▼
Client receives:       state + lastInputSeq=3
                       │
                       ├─► Accept server state
                       │
                       ├─► Discard seq 1,2,3 (already processed)
                       │   pendingInputs = [4, 5]
                       │
                       └─► Re-apply seq 4,5 on top of server state
                           (These are still "in flight")
```

---

## Why This Works

1. **Immediate feedback:** Player sees results of their input instantly (prediction)

2. **Server authority:** Server state is always correct. Client predictions may be wrong, but they get corrected.

3. **Smooth correction:** Usually client predictions are right (deterministic simulation). Only mispredictions cause visible corrections.

4. **No cheating:** Client can predict, but server validates. Cheating clients get corrected.

---

## Misprediction and Smoothing

Sometimes client prediction is wrong:

- Another player shot your ship (client didn't know)
- Server physics differs slightly
- Packet loss caused input to arrive late

When misprediction happens, you have options:

### Option 1: Snap Correction

```typescript
// Instantly correct to server state
localState = serverState;
// Can be jarring if misprediction is large
```

### Option 2: Smooth Interpolation

```typescript
// Blend toward server state over time
localState = lerp(localState, serverState, 0.1);
// Less jarring, but can feel "floaty"
```

### Option 3: Rollback + Replay (Best but complex)

```typescript
// Roll back to server state
localState = serverState;
// Replay all pending inputs at high speed
for (const input of pendingInputs) {
  applyInput(localState, input);
}
// Used in fighting games, very precise
```

---

## Field Reference

### Client → Server

| Field   | Type       | Purpose                                        |
| ------- | ---------- | ---------------------------------------------- |
| `type`  | string     | Message type ("input", "aim", "shoot")         |
| `seq`   | number     | Monotonically increasing sequence (1, 2, 3...) |
| `tick`  | number     | Client's game tick when input was made         |
| `keys`  | InputState | For "input": WASD state                        |
| `angle` | number     | For "aim": mouse aim angle                     |

### Server → Client

| Field          | Type      | Purpose                              |
| -------------- | --------- | ------------------------------------ |
| `type`         | string    | Message type ("state", "hit", etc.)  |
| `state`        | GameState | Full authoritative game state        |
| `lastInputSeq` | number    | Last input sequence server processed |

---

## Implementation Notes

### When to Add Prediction

**Start simple (no prediction):**

1. Client sends inputs to server
2. Server sends state back
3. Client renders server state directly
4. Works fine for low-latency (local network)

**Add prediction when:**

- Testing with real network latency
- Players complain about "lag"
- Targeting competitive/action gameplay

### Testing

To test prediction locally, add artificial delay:

```typescript
// Simulate 100ms network latency
setTimeout(() => {
  ws.send(JSON.stringify(input));
}, 100);
```

Without prediction: game feels sluggish.
With prediction: game feels responsive.

---

## SuperCluster Implementation Status

| Feature                        | Status    | Notes                         |
| ------------------------------ | --------- | ----------------------------- |
| Sequence numbers in messages   | ⬜ TODO   | Add `seq` to ClientMessage    |
| `lastInputSeq` in StateMessage | ⬜ TODO   | Add to StateMessage           |
| Client input buffer            | ⬜ TODO   | Store pending inputs          |
| Server input tracking          | ⬜ TODO   | Track per-player lastInputSeq |
| Reconciliation logic           | ⬜ TODO   | Re-apply pending inputs       |
| Misprediction smoothing        | ⬜ Future | Start with snap correction    |

---

## Further Reading

- [Gabriel Gambetta's Game Networking Series](https://www.gabrielgambetta.com/client-server-game-architecture.html) - Excellent deep dive
- [Valve's Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking) - Real-world example
- [Overwatch Netcode](https://www.youtube.com/watch?v=W3aieHjyNvw) - GDC talk on favor-the-shooter
