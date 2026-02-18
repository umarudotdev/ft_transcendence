# Movement on a Sphere

This document explains how movement works in SuperCluster. There are two main movement systems:

1. **Planet Movement** - The illusion of ship movement (WASD rotates the planet)
2. **Asteroid Movement** - Asteroids drifting on the sphere surface

Both use **quaternion-based rotation** to avoid gimbal lock and enable smooth pole crossing.

---

## Two Types of Movement

| What moves                     | When                | Purpose                          |
| ------------------------------ | ------------------- | -------------------------------- |
| Planet (via quaternion)        | Player presses WASD | Creates illusion that ship moves |
| Asteroids (via `moveOnSphere`) | Every frame         | Asteroids drift on their own     |

**Key insight**: The ship is visually **fixed** at position (0, 0, radius). The planet rotates under it. Asteroids are children of the planet, so they rotate with it AND have their own drift.

---

## Part 1: Planet Movement (`updateLocalMovement`)

**File**: `GameRenderer.ts`, lines 259-340

### The Illusion

The ship never actually moves in 3D space. Instead:

- Ship stays at (0, 0, gameSphereRadius)
- Planet rotates when you press WASD
- This creates the illusion of the ship flying over the surface

### Key Variables

```
planetQuaternion    - Stores planet's total rotation
shipPosition        - Unit vector tracking where ship "actually" is on planet
_pitchAxis          - (1, 0, 0) = X-axis for forward/backward
_yawAxis            - (0, 1, 0) = Y-axis for left/right
```

### Step-by-Step Breakdown

#### Step 1: Calculate rotation angles (lines 296-302)

```
let pitchAngle = 0;  // Forward/backward
let yawAngle = 0;    // Left/right

if (forward) pitchAngle += speed * deltaTime;
if (backward) pitchAngle -= speed * deltaTime;
if (left) yawAngle += speed * deltaTime;
if (right) yawAngle -= speed * deltaTime;
```

Convert input to rotation angles. `speed * deltaTime` gives consistent movement regardless of framerate.

#### Step 2: Apply pitch rotation (lines 306-313)

```
if (pitchAngle !== 0) {
    _tempQuat.setFromAxisAngle(_pitchAxis, pitchAngle);
    planetQuaternion.premultiply(_tempQuat);

    _tempQuat.invert();
    shipPosition.applyQuaternion(_tempQuat);
}
```

**What's happening:**

1. Create a quaternion that rotates around X-axis by `pitchAngle`
2. `premultiply` - apply this rotation BEFORE existing rotation
3. `invert` - flip the rotation direction
4. Apply inverted rotation to `shipPosition` (ship moves opposite to planet)

**Why `premultiply` vs `multiply`?**

```
multiply:     result = existing * new    (rotate in local space)
premultiply:  result = new * existing    (rotate in world space)
```

We use `premultiply` so the rotation axes stay aligned with the camera, not the planet.

#### Step 3: Apply yaw rotation (lines 316-323)

Same logic for left/right movement, but around Y-axis.

#### Step 4: Normalize (lines 326-327)

```
planetQuaternion.normalize();
shipPosition.normalize();
```

Prevent floating-point drift. Without this, values slowly accumulate errors.

#### Step 5: Apply to visual (line 330)

```
planet.group.quaternion.copy(planetQuaternion);
```

Three.js automatically renders the planet with this rotation.

### Visual Representation

```
Player presses W (forward):

1. Before:
   Camera → [Ship] → Planet
                     (asteroids here)

2. Planet rotates DOWN (pitch around X):
   Camera → [Ship] → Planet ↓
                     (asteroids slide up toward ship)

3. Ship appears to move forward, but it's the planet rotating!
```

---

## Part 2: Asteroid Movement (`moveOnSphere`)

**File**: `Asteroid.ts`, lines 177-197

### Purpose

Asteroids drift on the sphere surface independently of player movement. Even if you stand still, asteroids keep moving.

### The Challenge

On a flat plane, movement is simple:

```
position += velocity * deltaTime
```

On a sphere, this would make objects fly off into space! Instead, we rotate around the sphere center.

### Step-by-Step Breakdown

#### Step 1: Calculate angular distance (line 179)

```
const angle = asteroid.speed * deltaTime;
```

- `speed` = how fast asteroid moves (radians per second)
- `deltaTime` = time since last frame
- `angle` = how many radians to move this frame

Example: speed=0.2 rad/s, deltaTime=0.016s → angle = 0.0032 radians (~0.18°)

#### Step 2: Find the rotation axis (line 185)

```
const axis = new Vector3().crossVectors(asteroid.position, asteroid.velocity).normalize();
```

**Cross product** of position × velocity gives the axis to rotate around:

```
        velocity →
           ↗
    position ●
         ↑
       axis (perpendicular to both)
```

Think of it like a wheel axle:

- `position` = where you are (points from sphere center outward)
- `velocity` = direction you want to go (tangent to sphere)
- `axis` = the axle of a wheel that would roll in that direction

#### Step 3: Create rotation quaternion (line 188)

```
const quat = new Quaternion().setFromAxisAngle(axis, angle);
```

Creates a quaternion that says: "rotate `angle` radians around `axis`"

**Why quaternion instead of Euler angles?**

- No gimbal lock at poles
- Smooth interpolation
- Easy to combine multiple rotations

#### Step 4: Rotate the position (lines 191-192)

```
asteroid.position.applyQuaternion(quat);
asteroid.position.normalize();
```

1. `applyQuaternion` - rotates the position vector around the axis
2. `normalize` - keeps it on the unit sphere (length = 1)

The normalize prevents "drift" - floating point errors could slowly move the asteroid off the sphere surface.

#### Step 5: Rotate velocity to stay tangent (lines 195-196)

```
asteroid.velocity.applyQuaternion(quat);
asteroid.velocity.normalize();
```

**This is critical!** As the asteroid moves, its velocity must also rotate to stay tangent to the sphere.

```
Before move:              After move:
      → velocity              ↗ velocity (rotated)
      ●                        ●
     /                        /
    / sphere                 / sphere
```

If you didn't rotate velocity, the asteroid would eventually aim off the sphere surface.

### Visual Summary

```
1. Start:
   position ●→ velocity
           |
          axis (into page)

2. Rotate around axis:

           ●→  (new position, new velocity)
          /
         /
   old ●→

3. Both position and velocity rotated by same amount
   → asteroid stays on sphere
   → velocity stays tangent
```

---

## Why Quaternions?

### The Gimbal Lock Problem

With Euler angles (pitch, yaw, roll), when pitch = 90°, yaw and roll become the same axis. This is "gimbal lock" - you lose a degree of freedom.

```
Normal:                    Gimbal lock (pitch = 90°):

  Y (yaw)                    Y and Z aligned!
  |                          |
  |___X (roll)               |___X
  /
 Z (pitch)                   Can't rotate around Z anymore
```

### Quaternions Avoid This

Quaternions represent rotation as a 4D vector (w, x, y, z). They:

- Have no gimbal lock
- Interpolate smoothly (slerp)
- Compose cleanly (multiply quaternions)

---

## Summary

| System          | What rotates              | Axis source                          | Purpose                     |
| --------------- | ------------------------- | ------------------------------------ | --------------------------- |
| Planet movement | `planet.group.quaternion` | Fixed X and Y axes                   | Ship movement illusion      |
| Asteroid drift  | `asteroid.position`       | Cross product of position × velocity | Independent object movement |

Both systems:

1. Calculate rotation axis
2. Create quaternion from axis + angle
3. Apply quaternion to position
4. Normalize to prevent drift
5. (Asteroids only) Also rotate velocity to stay tangent
