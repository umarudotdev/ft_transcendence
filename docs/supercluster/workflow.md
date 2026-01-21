# SuperCluster - Development Workflow

## Code Location

```
packages/supercluster/src/          # Shared types (client & server)
├── index.ts                        # Package exports
├── types.ts                        # GameState, SphericalPosition, Messages

apps/web/src/lib/supercluster/      # Three.js renderer (client-only)
├── index.ts                        # Module exports
├── SuperCluster.svelte             # Svelte wrapper component
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

### Step 1.4: Camera Setup
**Goal**: Camera fixed behind ship, looking at sphere center
**Tasks**:
- [ ] Position camera behind ship (along ship's "up" from sphere)
- [ ] Camera looks at sphere center (0,0,0)
- [ ] Adjust FOV and distance for good view
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

### Step 1.6: Planet Rotation (Movement)
**Goal**: WASD rotates planet, ship appears to move
**Tasks**:
- [ ] On W/S: rotate planet around X-axis (forward/backward)
- [ ] On A/D: rotate planet around Z-axis (left/right)
- [ ] Smooth rotation (delta time based)
- [ ] Track ship's logical position (phi, theta) as planet rotates
**Test**: Planet visibly rotates, ship stays in place but "moves" over surface

### Step 1.7: Polish & Debug Helpers
**Goal**: Clean up iteration 1
**Tasks**:
- [x] Add AxesHelper for debugging orientation
- [ ] Adjust rotation speed for good feel
- [x] lil-gui debug panel
- [ ] Clean up code structure
**Test**: Smooth movement, no jitter, good visual feel

---

## Iteration 2: Shooting Mechanics

### Step 2.1: Mouse Tracking
**Goal**: Track mouse position for aiming
**Tasks**:
- [x] Add mousemove event listener
- [x] Convert mouse position to angle from canvas center
- [ ] Calculate aim direction on tangent plane
**Test**: Console shows aim angle updating

### Step 2.2: Aim Indicator
**Goal**: Visual line showing aim direction
**Tasks**:
- [ ] Create line geometry from ship position
- [ ] Line follows tangent plane
- [ ] Length = visible arc on sphere
- [ ] Updates with mouse movement
**Test**: Line rotates around ship as mouse moves

### Step 2.3: Projectile Creation
**Goal**: Click spawns projectile
**Tasks**:
- [ ] Create projectile geometry (small sphere or line)
- [ ] Spawn at ship position with aim direction
- [ ] Store projectile data (position, velocity, lifetime)
**Test**: Click creates visible projectile

### Step 2.4: Projectile Movement
**Goal**: Projectiles travel along sphere surface
**Tasks**:
- [ ] Move projectile along great circle path
- [ ] Update projectile position each frame
- [ ] Remove projectile after traveling set distance or time
**Test**: Projectiles travel and disappear

---

## Iteration 3: Moving Objects

### Step 3.1: Object Spawning
**Goal**: Spawn objects on planet surface
**Tasks**:
- [ ] Create simple object geometry (cube or sphere)
- [ ] Spawn at random position on planet
- [ ] Orient to surface normal
**Test**: Objects appear on planet

### Step 3.2: Object Self-Rotation
**Goal**: Objects spin around their own axis
**Tasks**:
- [ ] Add rotation component to objects
- [ ] Update rotation each frame
**Test**: Objects visibly spinning

### Step 3.3: Object Movement on Surface
**Goal**: Objects move along planet surface
**Tasks**:
- [ ] Give objects velocity (angular)
- [ ] Update position along sphere surface
- [ ] Keep oriented to surface
**Test**: Objects move around planet

### Step 3.4: Use InstancedMesh
**Goal**: Optimize for many objects
**Tasks**:
- [ ] Convert to InstancedMesh
- [ ] Manage instance transforms
- [ ] Test with 100+ objects
**Test**: Smooth performance with many objects

---

## Future Iterations (outline)

### Iteration 4: Collision Detection
- Projectile vs Object collision
- Ship vs Object collision
- Angular distance calculations

### Iteration 5: Game Logic
- Score system
- Lives/health
- Object destruction effects
- Power-ups

### Iteration 6: Enemy AI
- Enemies that chase ship
- Different enemy types
- Spawn waves

### Iteration 7: Polish
- Visual effects (particles, explosions)
- Sound effects
- UI overlay
- Post-processing

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
