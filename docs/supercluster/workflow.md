# SuperCluster - Development Workflow

## Code Location

```
packages/supercluster/src/          # Shared types (client & server)
├── index.ts                        # Package exports
├── types.ts                        # GameState, SphericalPosition, InputMessage, StateMessage

apps/api/src/modules/supercluster/  # Server-side game logic (authoritative)
├── supercluster.controller.ts      # WebSocket route handlers
├── supercluster.service.ts         # Game session management
├── game-server.ts                  # 60 Hz tick loop, physics, state
├── game-session.ts                 # Individual game instance
└── input-validator.ts              # Anti-cheat input validation

apps/web/src/lib/supercluster/      # Three.js renderer (client-only)
├── index.ts                        # Module exports
├── SuperCluster.svelte             # Svelte wrapper + WebSocket client
├── network/
│   ├── client.ts                   # WebSocket connection, input sending
│   ├── prediction.ts               # Client-side prediction logic
│   └── reconciliation.ts           # Server reconciliation logic
├── renderer/
│   ├── GameRenderer.ts             # Main renderer orchestrator
│   ├── Planet.ts                   # Planet + force-field meshes
│   └── Ship.ts                     # Player ship mesh
├── shaders/
│   └── forceField.ts               # Force-field fade shader
└── debug/
    └── DebugGui.ts                 # lil-gui debug controls
```

---

## Iteration 1: Basic Scene (Current)

### Step 1.1: Empty Scene Setup ✓
**Goal**: Renderer, scene, camera, render loop working
**Tasks**:
- [x] Create GameRenderer.ts
- [x] Setup WebGLRenderer with canvas
- [x] Create Scene with dark background color
- [x] Create PerspectiveCamera
- [x] Add basic lighting (ambient + directional)
- [x] Render loop with requestAnimationFrame
- [x] Setup lil-gui (DebugGui.ts)
**Test**: Browser shows colored background, no errors in console, GUI panel visible

### Step 1.2: Add Planet (3-Layer Spheres) ✓
**Goal**: Visible planet with force-field
**Tasks**:
- [x] Create parent Object3D to hold all spheres (for unified rotation)
- [x] Create Planet sphere (solid, radius=70)
- [x] Create Force-field sphere (wireframe grid, radius=95)
- [x] Game sphere is invisible (radius=100) - just conceptual for now
- [x] Add lil-gui controls for radii
- [x] Add AxesHelper with GUI toggle
- [x] Position camera to see spheres
- [x] Custom shader for force-field fading
**Test**: See solid planet with wireframe force-field around it

### Step 1.3: Add Ship (Triangle) ✓
**Goal**: Triangle ship visible on sphere surface
**Tasks**:
- [x] Create triangle geometry (BufferGeometry with 3 vertices)
- [x] Position ship at center of camera view (phi=π/2, theta=π/2)
- [x] Orient ship to face tangent to sphere
- [x] Red color to contrast with blue planet
- [x] lil-gui controls for ship position (phi, theta, aimAngle)
**Test**: See red triangle on sphere surface, adjustable via GUI

### Step 1.4: Camera Setup ✓
**Goal**: Camera fixed behind ship, looking at sphere center
**Tasks**:
- [x] Position camera behind ship (along ship's "up" from sphere)
- [x] Camera looks at sphere center (0,0,0)
- [x] Adjust FOV and distance for good view
- [x] Ship uses fixed visual position (planet rotates under it)
**Test**: Ship visible in lower-center of screen, planet curves away

### Step 1.5: Input Handling ✓
**Goal**: Capture keyboard input for movement
**Tasks**:
- [x] Add keydown/keyup event listeners
- [x] Track pressed keys state (W/A/S/D and arrows)
- [x] Create input state object accessible in game loop
- [x] Mouse move for aim angle
- [x] Click for shoot (sends message)
**Test**: Input events captured and logged

### Step 1.6: Planet Rotation (Movement) ✓
**Goal**: WASD rotates planet, ship appears to move
**Tasks**:
- [x] On W/S: rotate planet around X-axis (forward/backward)
- [x] On A/D: rotate planet around Y-axis (left/right)
- [x] Smooth rotation (delta time based)
- [x] Track ship's logical position as planet rotates
- [x] Connect input from component to renderer
- [x] **Quaternion-based rotation** (no gimbal lock, smooth pole crossing)
- [x] **Unit vector position tracking** (for collision detection)
**Test**: Planet visibly rotates, ship stays in place but "moves" over surface, can cross poles smoothly

### Step 1.7: Polish & Debug Helpers
**Goal**: Clean up iteration 1
**Tasks**:
- [x] Add AxesHelper for debugging orientation
- [x] Adjust rotation speed for good feel (configurable via GameConfig.shipSpeed)
- [x] lil-gui debug panel
- [ ] Clean up code structure
- [ ] Add camera distance/angle to debug controls
**Test**: Smooth movement, no jitter, good visual feel

---

## Iteration 2: Networking Foundation

> **Architecture Reference**: See [networking.md](./networking.md) for detailed diagrams and message formats.

### Step 2.1: Shared Types & Message Formats
**Goal**: Define shared types used by both client and server
**Tasks**:
- [ ] Define `InputMessage` type in `packages/supercluster/src/types.ts`
  ```typescript
  interface InputMessage {
    seq: number;           // Sequence number for reconciliation
    tick: number;          // Client's local tick when input was made
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    aimAngle: number;      // Radians
    shoot: boolean;
  }
  ```
- [ ] Define `StateMessage` type
  ```typescript
  interface StateMessage {
    tick: number;          // Server tick
    lastProcessedSeq: number;  // Last input seq server processed for this client
    players: PlayerState[];
    projectiles: ProjectileState[];
    asteroids: AsteroidState[];
  }
  ```
- [ ] Define `PlayerState`, `ProjectileState`, `AsteroidState` types
- [ ] Export all types from package
**Test**: Types compile without errors, importable from both apps

### Step 2.2: Server Game Loop (60 Hz Tick)
**Goal**: Server runs authoritative game simulation at fixed timestep
**Tasks**:
- [ ] Create `GameServer` class in `apps/api/src/modules/supercluster/`
- [ ] Implement fixed 60 Hz tick loop using `setInterval` (16.67ms)
- [ ] Track `currentTick` number (incrementing each tick)
- [ ] Store authoritative `GameState` on server
- [ ] Process pending inputs from all connected players each tick
- [ ] Update all entity positions (players, projectiles, asteroids)
- [ ] Run collision detection
- [ ] Queue state snapshots for broadcasting
**Test**: Server logs tick numbers, consistent 60 Hz timing

### Step 2.3: WebSocket Infrastructure
**Goal**: Establish real-time communication channel
**Tasks**:
- [ ] Create Elysia WebSocket route `/ws/supercluster/:gameId`
- [ ] Handle `open` event - register player, assign playerId
- [ ] Handle `close` event - remove player from game
- [ ] Handle `message` event - parse and queue InputMessage
- [ ] Store WebSocket connections mapped to playerId
- [ ] Create `broadcast()` helper to send to all players in game
- [ ] Add heartbeat/ping-pong for connection health
**Test**: Client connects, server logs connection, reconnect works

### Step 2.4: Client Input Transmission
**Goal**: Client sends inputs to server with sequence numbers
**Tasks**:
- [ ] Create WebSocket connection in `SuperCluster.svelte`
- [ ] Assign incrementing `seq` number to each input
- [ ] Send `InputMessage` on every keydown/keyup (not just state changes)
- [ ] Also send input at fixed rate (60 Hz) while keys held
- [ ] Store sent inputs in local buffer (for reconciliation later)
- [ ] Include current `aimAngle` in every message
- [ ] Send `shoot: true` on mouse click
**Test**: Server receives inputs, logs seq numbers incrementing

### Step 2.5: Server Input Processing
**Goal**: Server applies client inputs to authoritative state
**Tasks**:
- [ ] Queue incoming inputs per-player (handle out-of-order)
- [ ] Process inputs in seq order during tick
- [ ] Apply movement: rotate player's position on sphere
- [ ] Apply shooting: spawn projectile at player position + aimAngle
- [ ] Track `lastProcessedSeq` per player
- [ ] Validate inputs (rate limiting, bounds checking)
**Test**: Player moves on server when client sends WASD inputs

### Step 2.6: State Broadcasting
**Goal**: Server sends authoritative state to all clients
**Tasks**:
- [ ] Build `StateMessage` after each tick
- [ ] Include all player positions, projectiles, asteroids
- [ ] Include `lastProcessedSeq` for each receiving player
- [ ] Broadcast to all connected players via WebSocket
- [ ] Consider delta compression later (send only changes)
**Test**: Client receives state messages at ~60 Hz

### Step 2.7: Client State Reception
**Goal**: Client receives and applies server state
**Tasks**:
- [ ] Parse incoming `StateMessage` in WebSocket handler
- [ ] Update `GameRenderer` with server positions for OTHER players
- [ ] Update projectiles and asteroids from server state
- [ ] Store received `serverTick` and `lastProcessedSeq`
- [ ] Calculate approximate latency (RTT/2)
**Test**: Other player's ship visible and moving based on server state

### Step 2.8: Client-Side Prediction
**Goal**: Local player sees immediate response to input
**Tasks**:
- [ ] Apply own inputs locally IMMEDIATELY (don't wait for server)
- [ ] Run local physics simulation for own ship
- [ ] Render own ship at predicted position
- [ ] Keep buffer of unacknowledged inputs (seq > lastProcessedSeq)
- [ ] Local projectile spawning for immediate visual feedback
**Test**: Zero input lag - ship responds instantly to WASD

### Step 2.9: Server Reconciliation
**Goal**: Correct client prediction when it diverges from server
**Tasks**:
- [ ] When receiving `StateMessage`, compare own position with server's
- [ ] If mismatch: reset own position to server's authoritative position
- [ ] Re-apply all unacknowledged inputs (seq > lastProcessedSeq)
- [ ] Remove acknowledged inputs from buffer (seq <= lastProcessedSeq)
- [ ] Smooth small corrections (lerp) to avoid visual "snap"
- [ ] For large corrections (cheating/lag), snap immediately
**Test**: Simulate lag - client eventually matches server state

### Step 2.10: Entity Interpolation
**Goal**: Smooth movement for entities we don't predict
**Tasks**:
- [ ] Buffer last 2-3 state snapshots for other players
- [ ] Render other players slightly in the past (interpolation delay)
- [ ] Lerp between buffered positions for smooth movement
- [ ] Same for projectiles and asteroids
- [ ] Handle missing snapshots gracefully (extrapolate briefly)
**Test**: Other player moves smoothly even with network jitter

### Step 2.11: Anti-Cheat Validation
**Goal**: Server validates all inputs and rejects invalid ones
**Tasks**:
- [ ] Rate limit inputs (max 120 inputs/sec per player)
- [ ] Validate movement speed (can't move faster than max)
- [ ] Validate shoot rate (respect cooldown)
- [ ] Validate aim angle bounds (-π to π)
- [ ] Log suspicious activity for review
- [ ] Kick players with repeated violations
**Test**: Modified client can't move faster or shoot faster

### Step 2.12: Game Session Management
**Goal**: Support different game modes and lobbies
**Tasks**:
- [ ] Create `GameSession` class to manage one game instance
- [ ] Support 1v1 mode: 2 players, competitive
- [ ] Support Co-op mode: 1-2 players vs AI asteroids
- [ ] Implement lobby/matchmaking (simple: first 2 players matched)
- [ ] Handle player disconnect (pause or AI takeover)
- [ ] Game over conditions (lives depleted, time limit)
- [ ] Score tracking per session
**Test**: Two browsers can join same game, play together

---

## Iteration 3: Shooting Mechanics

### Step 3.1: Mouse Tracking
**Goal**: Track mouse position for aiming
**Tasks**:
- [x] Add mousemove event listener
- [x] Convert mouse position to angle from canvas center
- [ ] Calculate aim direction on tangent plane
**Test**: Console shows aim angle updating

### Step 3.2: Aim Indicator
**Goal**: Visual line showing aim direction
**Tasks**:
- [ ] Create line geometry from ship position
- [ ] Line follows tangent plane
- [ ] Length = visible arc on sphere
- [ ] Updates with mouse movement
**Test**: Line rotates around ship as mouse moves

### Step 3.3: Projectile Creation
**Goal**: Click spawns projectile
**Tasks**:
- [ ] Create projectile geometry (small sphere or line)
- [ ] Spawn at ship position with aim direction
- [ ] Store projectile data (position, velocity, lifetime)
**Test**: Click creates visible projectile

### Step 3.4: Projectile Movement
**Goal**: Projectiles travel along sphere surface
**Tasks**:
- [ ] Move projectile along great circle path
- [ ] Update projectile position each frame
- [ ] Remove projectile after traveling set distance or time
**Test**: Projectiles travel and disappear

---

## Iteration 5: Moving Objects

### Step 5.1: Object Spawning
**Goal**: Spawn objects on planet surface
**Tasks**:
- [ ] Create simple object geometry (cube or sphere)
- [ ] Spawn at random position on planet
- [ ] Orient to surface normal
**Test**: Objects appear on planet

### Step 5.2: Object Self-Rotation
**Goal**: Objects spin around their own axis
**Tasks**:
- [ ] Add rotation component to objects
- [ ] Update rotation each frame
**Test**: Objects visibly spinning

### Step 5.3: Object Movement on Surface
**Goal**: Objects move along planet surface
**Tasks**:
- [ ] Give objects velocity (angular)
- [ ] Update position along sphere surface
- [ ] Keep oriented to surface
**Test**: Objects move around planet

### Step 5.4: Use InstancedMesh
**Goal**: Optimize for many objects
**Tasks**:
- [ ] Convert to InstancedMesh
- [ ] Manage instance transforms
- [ ] Test with 100+ objects
**Test**: Smooth performance with many objects

---

## Future Iterations (outline)

### Iteration 6: Collision Detection
- Projectile vs Object collision
- Ship vs Object collision
- Angular distance calculations on sphere surface
- Hit detection using dot product of unit vectors

### Iteration 7: Game Logic
- Score system
- Lives/health
- Object destruction effects
- Power-ups
- Wave progression

### Iteration 8: Enemy AI
- Enemies that chase ship
- Different enemy types
- Spawn waves
- AI difficulty scaling

### Iteration 9: Polish
- Visual effects (particles, explosions)
- Sound effects
- UI overlay (HUD, score, lives)
- Post-processing (bloom, color grading)
- Screen shake on hits

---

## Debug GUI Controls

Available when `debug={true}`:

| Folder | Control | Description |
|--------|---------|-------------|
| Renderer | Show Axes | Toggle AxesHelper visibility |
| Renderer | Force Field Front | Front-facing opacity (0-1) |
| Renderer | Force Field Back | Back-facing opacity (0-1) |
| Game Config | Game Sphere R | Game sphere radius |
| Game Config | Force Field R | Force-field radius |
| Game Config | Planet R | Planet radius |
| Ship Position | Phi | Ship latitude (0.1 to π-0.1) |
| Ship Position | Theta | Ship longitude (0 to 2π) |
| Ship Position | Aim Angle | Ship aim direction (-π to π) |
