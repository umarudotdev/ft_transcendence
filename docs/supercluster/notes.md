# SuperCluster - Development Notes

Random observations, ideas, and learnings as we go.

---

## Architecture Decisions

### Code Organization (2025-01-21)

After discussion, decided on this structure:

- **packages/supercluster**: Only shared types and (future) engine logic
  - Types used by both client renderer and server game logic
  - Engine code for client-side prediction
  - NO Three.js or Svelte dependencies

- **apps/web/src/lib/supercluster**: Client-only rendering
  - Three.js renderer classes
  - Svelte component wrapper
  - lil-gui debug tools

This separation ensures:

1. Server can import types without pulling in Three.js
2. Client-side prediction can reuse server physics logic
3. Clear dependency boundaries

---

## Three-Layer Sphere Structure

Decided on 3 concentric spheres:

1. **Game Sphere** (radius=100, invisible) - where ship and all game objects actually move
2. **Force-field** (radius=95) - visible wireframe with custom fading shader
3. **Planet** (radius=70) - solid blue sphere, the actual planet surface

This gives nice visual depth and separation.

---

## Coordinate System

Using spherical coordinates (phi, theta) to track positions on the sphere surface.

- **phi**: polar angle from Y-axis (0 to π) - 0=north pole, π=south pole
- **theta**: azimuthal angle in XZ plane (0 to 2π)

Conversion to Cartesian:

```typescript
x = radius * sin(phi) * cos(theta)
y = radius * cos(phi)
z = radius * sin(phi) * sin(theta)
```

---

## Movement Paradigm

Instead of moving the ship, we rotate all spheres together. Ship stays fixed relative to camera. This simplifies camera logic significantly.

The ship mesh is positioned at a fixed visual location `(0, 0, gameSphereRadius)`, and the planet rotates under it to create the illusion of movement.

---

## Quaternion-Based Rotation (2026-01-21)

### The Problem with Spherical Coordinates

Initially we used spherical coordinates (phi, theta) to track ship position and Euler angles for planet rotation. This caused issues at the poles:

- **Singularity**: At phi=0 (north pole) or phi=π (south pole), all theta values map to the same point
- **Gimbal-like behavior**: Approaching poles caused discontinuous jumps in theta
- **No smooth pole crossing**: Ship would "bounce" at poles instead of crossing smoothly

### The Solution: Quaternions + Unit Vectors

We now use a dual-representation system:

1. **Planet Quaternion** (`THREE.Quaternion`): Stores the planet's rotation state
   - No gimbal lock
   - Smooth interpolation everywhere
   - Accumulates rotations via multiplication

2. **Ship Position** (`THREE.Vector3`): Unit vector on sphere surface (x² + y² + z² = 1)
   - Instant access to ship position
   - Natural for collision detection: `angularDist = acos(dot(v1, v2))`
   - Convert to phi/theta when needed for compatibility

### How Movement Works

```typescript
// On WASD input, create rotation quaternions:
pitchQuat.setFromAxisAngle(X_AXIS, pitchAngle);  // Forward/backward
yawQuat.setFromAxisAngle(Y_AXIS, yawAngle);      // Left/right

// Apply to planet (pre-multiply for local-space rotation):
planetQuaternion.premultiply(pitchQuat);
planetQuaternion.premultiply(yawQuat);

// Track ship position (inverse rotation):
shipPosition.applyQuaternion(pitchQuat.invert());
shipPosition.applyQuaternion(yawQuat.invert());
```

### Coordinate Conversion

When we need spherical coordinates (for server sync, debug GUI):

```typescript
// Unit vector → Spherical
phi = acos(y);              // 0 to π
theta = atan2(z, x);        // -π to π (adjust to 0 to 2π)

// Spherical → Unit vector
x = sin(phi) * cos(theta)
y = cos(phi)
z = sin(phi) * sin(theta)
```

### Trade-offs

| Aspect          | Spherical Only | Quaternion + Unit Vector |
| --------------- | -------------- | ------------------------ |
| Pole crossing   | Broken         | Smooth                   |
| Memory          | 2 floats       | 7 floats (4 + 3)         |
| Collision check | Convert first  | Direct dot product       |
| Server sync     | Native         | Convert when needed      |

---

## Force Field and Shaders

The force field uses a custom GLSL shader to fade lines based on their orientation relative to the camera.

For comprehensive documentation on:

- GLSL language basics
- Vertex and Fragment shaders
- Three.js ShaderMaterial
- Force field shader implementation details
- How uniforms, attributes, and varyings work

**See: [shaders.md](./shaders.md)**

---

## Ship Orientation and Aiming

The ship has **two independent angles**:

### 1. Direction Angle (WASD Input)

Controls where the ship tip points. Updated based on movement input:

- W = 0° (forward)
- W+D = 45° (forward-right)
- D = 90° (right)
- etc.

**Smooth rotation:** Ship direction lerps toward target angle using exponential smoothing:

```typescript
// Lerp factor based on speed and deltaTime
const lerpFactor = 1 - Math.exp(-rotationSpeed * deltaTime);
currentAngle += (targetAngle - currentAngle) * lerpFactor;
```

This creates a smooth ~0.3s rotation when changing direction.

### 2. Aim Angle (Mouse Input)

Controls where the aim dot is positioned, which determines shooting direction.

- Aim dot points **toward mouse cursor** on screen
- Calculated from mouse position relative to canvas center
- Aim dot orbits ship at fixed radius on the orbit circle
- Independent from ship direction - can move left while aiming right

```typescript
// Mouse position → aim angle
const dx = mouseX - canvasCenterX;
const dy = mouseY - canvasCenterY;
aimAngle = Math.atan2(dx, -dy);  // -dy because screen Y is inverted
```

### Visual Structure

```
        Ship Group (at gameSphereRadius on Z axis)
            │
            ├── Ship Mesh (rotated by directionAngle)
            │       └── 3D wedge shape, tip points -Y
            │
            ├── Aim Orbit (cosmetic circle)
            │       └── LineLoop showing aim dot path (30% opacity)
            │
            └── Aim Dot (positioned by aimAngle)
                    └── Small sphere on the orbit circle
```

### GUI Controls

- **Rotation Speed**: How fast ship rotates to new direction (1-30)
- **Aim Dot Size**: Radius of the aim dot (0.5-5)
- **Aim Dot Color**: Color picker
- **Aim Dot Orbit**: Distance from ship center (8-30)

---

## SSR Considerations

SvelteKit runs server-side rendering, so code that accesses `window` must be guarded:

```typescript
import { browser } from '$app/environment';

if (browser) {
  window.addEventListener('keydown', handler);
}
```

The `onMount` callback only runs on the client, but cleanup in `onDestroy` can run during SSR if component construction fails.

---

## Networking Architecture

SuperCluster uses **Client-side Prediction with Server Reconciliation** for multiplayer gameplay.

Key concepts:

- **Server is authoritative** - Server's game state is the "truth"
- **Client predicts locally** - Immediate visual feedback, no input lag
- **Reconciliation** - Client accepts server state and re-applies unacknowledged inputs
- **60 Hz tick rate** - Server updates 60 times per second

For comprehensive documentation on:

- Data flow diagrams
- Message formats (InputMessage, StateMessage)
- Tick rate and network rate
- Interpolation and smooth correction
- Anti-cheat validation
- Game modes (1v1 and Co-op)
- Implementation checklist

**See: [networking.md](./networking.md)**

---

## Ideas for Later

- ~~Asteroid breaking into smaller pieces~~ ✓ Implemented via `breakAsteroid()`
- Different asteroid shapes using BatchedMesh (varied geometries)
- Different weapon types (spread, focused, beam)
- Boost/dash ability with cooldown
- Shield power-up
- Particle effects for explosions
- Glow effect on force-field
- Post-processing (bloom, color grading)

---

## Asteroid System

### AsteroidRenderer Class

Uses `THREE.InstancedMesh` for efficient rendering of many asteroids with a single draw call.

```typescript
// AsteroidData structure
interface AsteroidData {
  id: number;
  position: THREE.Vector3;      // Unit vector on sphere (x² + y² + z² = 1)
  velocity: THREE.Vector3;      // Tangent direction for movement
  rotationSpeedX: number;       // Self-rotation speed (rad/s)
  rotationSpeedY: number;
  rotationX: number;            // Current rotation angle
  rotationY: number;
  size: number;                 // 1-4 (visual size multiplier: 2, 4, 6, 8)
  speed: number;                // Movement speed (rad/s on sphere)
}
```

### Movement on Sphere Surface

Asteroids move along great circles using quaternion rotation:

```typescript
// Axis perpendicular to position and velocity
const axis = new THREE.Vector3().crossVectors(position, velocity).normalize();

// Rotate position and velocity together
const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
position.applyQuaternion(quat);
velocity.applyQuaternion(quat);  // Keep velocity tangent
```

### Instance Matrix Composition

Each asteroid's transform is composed from:

1. **Position**: Unit vector × gameSphereRadius
2. **Orientation**: Basis matrix from (tangent, bitangent, normal)
3. **Self-rotation**: Euler angles applied after orientation
4. **Scale**: Based on size (SIZE_MULTIPLIERS array)

```typescript
const rotMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
quaternion.setFromRotationMatrix(rotMatrix);
quaternion.multiply(selfRotationQuaternion);
matrix.compose(position, quaternion, scale);
instancedMesh.setMatrixAt(index, matrix);
```

### Planet Parenting

Asteroids are children of the planet group, not the scene:

```typescript
this.planet.group.add(this.asteroids.group);
```

This means when the planet rotates (via WASD), asteroids automatically rotate with it, creating the illusion that the ship is flying past them.

---

## Performance Notes

### When to Use InstancedMesh/BatchedMesh

- **InstancedMesh**: For many identical objects (asteroids, same enemy type)
  - Single draw call for all instances
  - Each instance has its own transform matrix
  - All share same geometry and material
- **BatchedMesh**: If we need different geometries with same material (future: different asteroid shapes)
- Regular Mesh is fine for unique objects (ship, planet)

---

## Collision Detection

### Quick Reference

**Unit Vector**: A vector with length = 1. All positions on the sphere are stored as unit vectors.

```typescript
position = (x, y, z) where x² + y² + z² = 1
worldPosition = position × gameSphereRadius
```

**Angular Radius**: How much of the sphere an object covers (in radians).

```typescript
angularRadius = visualRadius / gameSphereRadius
// Size 1 asteroid (diameter=2): ≈ 0.01 rad
// Size 4 asteroid (diameter=8): ≈ 0.04 rad
```

**Collision Check**: Two objects collide when `dot product > cos(sum of radii)`

```typescript
const dot = posA.dot(posB);
const threshold = Math.cos(radiusA + radiusB);
if (dot > threshold) // Collision!
```

**Coordinate Spaces**: Keep everything in planet local space for efficiency.

- Asteroids: planet local (no transform needed)
- Bullets: planet local (no transform needed)
- Ship: transform once from world to planet local

For comprehensive documentation including spatial partitioning and implementation details:

**See: [collision.md](./collision.md)**

---

## Configuration System

SuperCluster uses a **three-tier configuration system** with clear separation between server-authoritative gameplay mechanics and client-side visual preferences.

### Configuration Types

1. **GameConfig** (Server-Authoritative)
   - All gameplay mechanics (speeds, collision, physics)
   - All speeds in rad/tick (converted to rad/sec by client)
   - Shared between client and server via `@ft/supercluster` package

2. **RendererConfig** (Client-Only)
   - Visual preferences (opacity, colors, rotation speed)
   - Debug options (axes, info display)
   - No effect on gameplay

3. **BulletConfig** (Client-Only)
   - Visual settings (color)
   - Performance caps (maxBullets)
   - No gameplay mechanics

### Key Architecture Decisions

**Single Source of Truth**: All projectile mechanics nested in `GameConfig.projectile`:

```typescript
GameConfig {
  projectile: {
    speed: number,        // rad/tick (server-authoritative)
    lifetime: number,     // ticks
    cooldown: number,     // ticks
    rayCount: number,     // affects collision
    spreadAngle: number,  // affects trajectory
  }
}
```

**Speed Units**: All speeds in `rad/tick`, client converts using `tickRate`:

```typescript
const speedRadPerSec = config.projectile.speed * config.tickRate;
```

**No Hardcoding**: Debug GUI initializes from actual config values, not hardcoded defaults.

For comprehensive documentation on configuration structure, units, and patterns:

**See: [configuration.md](./configuration.md)**

---

## Useful Resources

- Three.js Vector3.setFromSphericalCoords()
- Three.js InstancedMesh for many objects
- Haversine formula for angular distance on sphere
- Material.depthTest: https://threejs.org/docs/#api/en/materials/Material.depthTest
- ShaderMaterial for custom effects: https://threejs.org/docs/#api/en/materials/ShaderMaterial
