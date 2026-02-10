# SuperCluster - Collision System Design

## Overview

This document describes the collision detection system for SuperCluster, optimized for objects moving on a sphere surface.

---

## Core Concepts

### Unit Vectors for Position

#### What is a Vector?

A vector is a mathematical object with **direction** and **magnitude** (length). In 3D, we write it as `(x, y, z)`.

```
Example: Vector A = (3, 4, 0)

Length of A = √(3² + 4² + 0²) = √(9 + 16) = √25 = 5
```

#### What is a Unit Vector?

A **unit vector** is a vector with length exactly equal to **1**. We create it by dividing each component by the length (normalizing):

```
Vector A = (3, 4, 0)     length = 5
Unit vector = (3/5, 4/5, 0/5) = (0.6, 0.8, 0)

Check: √(0.6² + 0.8² + 0²) = √(0.36 + 0.64) = √1 = 1 ✓
```

#### Why Use Unit Vectors for Sphere Positions?

Think of the sphere as having radius 1 (the "unit sphere"). Every point on this sphere's surface can be described by a unit vector pointing from the center to that point:

```
           * Point P on sphere surface
          /|
         / |
        /  |     The unit vector IS the direction
       /   |     from center to the point.
      O----+     Length = 1 (on unit sphere)
    center

Point P = (x, y, z) where x² + y² + z² = 1
```

**The unit vector IS the position on the unit sphere.**

To get the actual world position on your game sphere (radius 100):

```typescript
// Unit vector (on sphere of radius 1)
const unitPosition = new THREE.Vector3(0.577, 0.577, 0.577); // length = 1

// World position (on sphere of radius 100)
const worldPosition = unitPosition.clone().multiplyScalar(100);
// Result: (57.7, 57.7, 57.7) - same direction, 100x longer
```

#### Your Asteroids Already Use This!

Look at your `AsteroidData`:

```typescript
interface AsteroidData {
  position: THREE.Vector3;  // ← This IS a unit vector!
  // ...
}
```

When you spawn an asteroid:

```typescript
const position = new THREE.Vector3(
  Math.sin(phi) * Math.cos(theta),
  Math.cos(phi),
  Math.sin(phi) * Math.sin(theta)
);
// This creates a unit vector! (sin²φcos²θ + cos²φ + sin²φsin²θ = 1)
```

**Why unit vectors for collision?**

- Collision math becomes simple dot products
- No need for square roots in distance calculations
- Natural representation for sphere surface positions
- Already used in `AsteroidData.position`

### Angular Distance (Not Euclidean)

On a sphere, we measure distance as the **angle** between two points (as seen from the center):

```
         * Point A
        /
       / angle θ
      /
     O--------* Point B
   (center)
```

For unit vectors, angular distance = `acos(dot(A, B))`:

```typescript
const dot = positionA.dot(positionB);  // Range: -1 to 1
const angularDistance = Math.acos(dot); // Range: 0 to π radians
```

**Key insight**: We often don't need `acos()` - just compare dot products directly!

### Angular Radius (Bounding "Circle")

On a flat plane, we use bounding boxes or bounding circles for collision.
On a sphere, we use **angular radius** - how much of the sphere an object "covers".

#### Visual Explanation

```
Side view of sphere with an object on its surface:

              ___---object---___
             /    ←  2r  →      \        r = visual radius (half of size)
            /    ___-----___     \
           |   /            \     |
           |  |      θ       |    |      θ = angular radius
           |   \     |      /     |
            \   \____|____/      /
             \      |           /
              ¯¯¯---O---¯¯¯
                  center

The angular radius θ is the angle from the center of the sphere
to the edge of the object.

tan(θ) = r / R   where r = visual radius, R = sphere radius
θ = atan(r / R)

For small angles (small objects): θ ≈ r / R  (in radians)
```

#### Converting Visual Size to Angular Radius

```typescript
// Your asteroids have SIZE_MULTIPLIERS = [2, 4, 6, 8]
// These are DIAMETERS in world units

function getAngularRadius(visualDiameter: number, sphereRadius: number): number {
  const visualRadius = visualDiameter / 2;
  return Math.atan(visualRadius / sphereRadius);
  // Or simplified for small objects: return visualRadius / sphereRadius;
}
```

#### How Different Asteroid Sizes Affect Collision

Your asteroids have different visual sizes:

| Size | Visual Diameter | Angular Radius     | Coverage |
| ---- | --------------- | ------------------ | -------- |
| 1    | 2 units         | ≈ 0.01 rad (0.57°) | Tiny     |
| 2    | 4 units         | ≈ 0.02 rad (1.15°) | Small    |
| 3    | 6 units         | ≈ 0.03 rad (1.72°) | Medium   |
| 4    | 8 units         | ≈ 0.04 rad (2.29°) | Large    |
| Ship | ~6 units        | ≈ 0.03 rad (1.72°) | Medium   |

```
Small asteroid (size 1):        Large asteroid (size 4):

      · tiny shadow               ████ large shadow
   on sphere surface             ████ on sphere surface

Angular radius ≈ 0.01 rad       Angular radius ≈ 0.04 rad
```

**The larger the asteroid, the larger its angular radius, and the easier it is to hit!**

#### Collision with Different Sizes

Two objects collide when the angular distance between their centers is less than the sum of their angular radii:

```
        ___                 ___
       /   \               /   \
      | A   |←-- θ_dist --→| B   |
       \___/               \___/
       r_A                  r_B

Collision if: θ_dist < r_A + r_B
```

Example: Ship (radius 0.03) vs Large asteroid (radius 0.04)

- Sum of radii = 0.07 rad
- Threshold = cos(0.07) ≈ 0.9975
- They collide if dot product > 0.9975

---

## Collision Detection Algorithm

### The Dot Product Check

Two objects collide when angular distance < sum of their angular radii:

```typescript
function checkCollision(
  posA: THREE.Vector3,  // Unit vector
  radiusA: number,      // Angular radius in radians
  posB: THREE.Vector3,  // Unit vector
  radiusB: number       // Angular radius in radians
): boolean {
  // Dot product = cos(angular distance)
  const dot = posA.dot(posB);

  // Collision threshold = cos(sum of radii)
  // Note: cos is decreasing, so collision when dot > threshold
  const threshold = Math.cos(radiusA + radiusB);

  return dot > threshold;
}
```

**Performance**: One dot product (3 multiplications + 2 additions) + one comparison. No square roots!

### Coordinate Space Transformation

Understanding coordinate spaces is crucial for collision detection.

#### The Two Spaces

**Planet Local Space**: Where asteroids live. When the planet rotates, objects in this space rotate with it. The asteroid's `position` unit vector stays the same, but its world position changes.

**World Space**: The fixed reference frame. The camera is here. The ship's logical position (`shipPosition`) is tracked here.

#### Current Implementation: World Space Projectiles

**Design Decision**: Projectiles are in **world space** (scene children) to ensure absolute velocity independent of ship movement direction. This fixes the reference frame issue where projectiles appeared slower when moving in the same direction as the ship.

```
World Space (fixed reference frame):
┌─────────────────────────────────────────┐
│                                         │
│         🚀 Ship (shipPosition)          │
│                                         │
│         💫 Projectile (world space)         │
│                                         │
│         📷 Camera                       │
│                                         │
└─────────────────────────────────────────┘

Planet Local Space (rotates with planet):
┌─────────────────────────────────────────┐
│                                         │
│    🪨 Asteroid A (position: unit vec)   │
│                                         │
│    🪨 Asteroid B (position: unit vec)   │
│                                         │
└─────────────────────────────────────────┘
```

#### Collision Check Strategy

**Projectile vs Asteroid**: Transform projectiles from world to planet local space:

```typescript
// Calculate inverse transform once per frame
const worldToPlanet = planetQuaternion.clone().invert();

for (const projectile of projectiles) {
  // Transform projectile position from world space to planet local space
  const bulletLocalPos = projectile.position
    .clone()
    .applyQuaternion(worldToPlanet)
    .normalize();

  for (const asteroid of asteroids) {
    // Both now in planet local space
    const dot = bulletLocalPos.dot(asteroid.position);
    const threshold = Math.cos(bulletRadius + asteroidRadius);
    if (dot > threshold) {
      // Collision!
    }
  }
}
```

**Ship vs Asteroid**: Ship already in world space, asteroids in planet local:

```typescript
// Transform ship position ONCE to planet local space
const shipLocal = this.shipPosition.clone();
const worldToPlanet = this.planetQuaternion.clone().invert();
shipLocal.applyQuaternion(worldToPlanet);
shipLocal.normalize();

for (const asteroid of asteroids) {
  const dot = shipLocal.dot(asteroid.position);
  // ...
}
```

#### Performance Trade-offs

| Collision Type     | Transforms Needed                 |
| ------------------ | --------------------------------- |
| Projectile vs Asteroid | N projectiles (world → planet local)  |
| Ship vs Asteroid   | 1 transform (ship → planet local) |
| Ship vs Projectile     | 0 (both in world space)           |

**Trade-off Analysis**:

- Transform N projectiles (typically 10-100) instead of keeping them in planet space
- **Benefit**: Consistent projectile physics - projectiles always travel at absolute speed
- **Cost**: O(N) quaternion transforms per frame
- **Optimization**: Calculate `worldToPlanet` once, reuse for all projectiles

**Alternative Design (Not Used)**: Keeping projectiles in planet local space would eliminate projectile transforms but reintroduce the reference frame issue where projectile speed appeared inconsistent based on ship movement direction.

---

## Spatial Partitioning: Icosahedral Grid

### Why Icosahedral?

The icosahedron has 20 triangular faces that tile the sphere nearly equally:

```
       /\      /\      /\
      /  \    /  \    /  \
     /    \  /    \  /    \
    /______\/______\/______\
    \      /\      /\      /
     \    /  \    /  \    /
      \  /    \  /    \  /
       \/      \/      \/
```

**Advantages:**

- Near-equal area cells (unlike lat/long grids)
- No pole singularities
- Matches your `IcosahedronGeometry` force field
- Hierarchical subdivision for finer grids

### Grid Structure

```typescript
// Subdivision levels and cell counts:
// Level 0: 20 faces (base icosahedron)
// Level 1: 80 faces (each face split into 4)
// Level 2: 320 faces
// Level 3: 1280 faces

interface IcosahedralGrid {
  subdivisionLevel: number;  // 0-3 typically
  cells: Map<number, Set<number>>;  // cellIndex → Set of object IDs
}
```

### Cell Assignment

To find which cell contains a unit vector:

```typescript
// Base icosahedron vertices (12 vertices)
const PHI = (1 + Math.sqrt(5)) / 2;  // Golden ratio ≈ 1.618
const ICOSAHEDRON_VERTICES = [
  new THREE.Vector3(0, 1, PHI).normalize(),
  new THREE.Vector3(0, 1, -PHI).normalize(),
  new THREE.Vector3(0, -1, PHI).normalize(),
  new THREE.Vector3(0, -1, -PHI).normalize(),
  new THREE.Vector3(1, PHI, 0).normalize(),
  new THREE.Vector3(1, -PHI, 0).normalize(),
  new THREE.Vector3(-1, PHI, 0).normalize(),
  new THREE.Vector3(-1, -PHI, 0).normalize(),
  new THREE.Vector3(PHI, 0, 1).normalize(),
  new THREE.Vector3(PHI, 0, -1).normalize(),
  new THREE.Vector3(-PHI, 0, 1).normalize(),
  new THREE.Vector3(-PHI, 0, -1).normalize(),
];

// Base icosahedron faces (20 faces, each defined by 3 vertex indices)
const ICOSAHEDRON_FACES = [
  [0, 2, 8], [0, 8, 4], [0, 4, 6], [0, 6, 10], [0, 10, 2],
  [2, 10, 7], [2, 7, 5], [2, 5, 8], [8, 5, 9], [8, 9, 4],
  [4, 9, 1], [4, 1, 6], [6, 1, 11], [6, 11, 10], [10, 11, 7],
  [1, 9, 3], [9, 5, 3], [5, 7, 3], [7, 11, 3], [11, 1, 3],
];

function findBaseFace(position: THREE.Vector3): number {
  // Find which of the 20 faces contains this point
  // The point is "inside" a face if it has positive dot product
  // with the face's center (average of 3 vertices)

  let bestFace = 0;
  let bestDot = -Infinity;

  for (let i = 0; i < 20; i++) {
    const [a, b, c] = ICOSAHEDRON_FACES[i];
    const center = new THREE.Vector3()
      .add(ICOSAHEDRON_VERTICES[a])
      .add(ICOSAHEDRON_VERTICES[b])
      .add(ICOSAHEDRON_VERTICES[c])
      .normalize();

    const dot = position.dot(center);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = i;
    }
  }

  return bestFace;
}
```

### Subdivision Within a Face

For finer grids, subdivide each triangular face:

```typescript
function getCellIndex(position: THREE.Vector3, subdivisionLevel: number): number {
  const baseFace = findBaseFace(position);

  if (subdivisionLevel === 0) {
    return baseFace;  // 0-19
  }

  // Get the 3 vertices of this face
  const [ai, bi, ci] = ICOSAHEDRON_FACES[baseFace];
  const a = ICOSAHEDRON_VERTICES[ai];
  const b = ICOSAHEDRON_VERTICES[bi];
  const c = ICOSAHEDRON_VERTICES[ci];

  // Use barycentric coordinates to find sub-cell
  const bary = getBarycentricCoords(position, a, b, c);
  const subCell = barycentricToSubCell(bary, subdivisionLevel);

  // Combine: baseFace * cellsPerFace + subCell
  const cellsPerFace = Math.pow(4, subdivisionLevel);
  return baseFace * cellsPerFace + subCell;
}

function getBarycentricCoords(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): { u: number; v: number; w: number } {
  // Project point onto the triangle's plane and compute barycentric coords
  // For a unit sphere, we can use spherical barycentric coordinates

  const v0 = b.clone().sub(a);
  const v1 = c.clone().sub(a);
  const v2 = p.clone().sub(a);

  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);

  const denom = d00 * d11 - d01 * d01;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;

  return { u, v, w };
}
```

### Neighbor Finding

Each cell has neighbors that must also be checked:

```typescript
function getNeighborCells(cellIndex: number, subdivisionLevel: number): number[] {
  // For level 0 (20 faces), each face has 3 edge-neighbors
  // For subdivided levels, each sub-cell has 3 neighbors within the face
  // plus potential neighbors in adjacent faces

  // Simplified: return the 3 adjacent faces for level 0
  // More complex neighbor tables needed for subdivided levels
  const neighbors: number[] = [];

  // ... implementation depends on subdivision level

  return neighbors;
}
```

---

## Complete Collision System

### SphericalCollisionSystem Class

```typescript
// packages/supercluster/src/collision/SphericalCollisionSystem.ts

import * as THREE from 'three';

export interface Collidable {
  id: number;
  position: THREE.Vector3;  // Unit vector
  angularRadius: number;    // Radians
  type: 'ship' | 'asteroid' | 'projectile' | 'powerup';
}

export interface Collision {
  a: Collidable;
  b: Collidable;
  angularDistance: number;
}

export class SphericalCollisionSystem {
  private subdivisionLevel: number;
  private cells: Map<number, Set<number>> = new Map();
  private objects: Map<number, Collidable> = new Map();

  // Precomputed neighbor tables
  private neighborTable: Map<number, number[]> = new Map();

  constructor(subdivisionLevel = 1) {
    this.subdivisionLevel = subdivisionLevel;
    this.precomputeNeighbors();
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Clear all objects and rebuild the spatial hash
   */
  clear(): void {
    this.cells.clear();
    this.objects.clear();
  }

  /**
   * Insert an object into the spatial hash
   */
  insert(obj: Collidable): void {
    this.objects.set(obj.id, obj);

    const cellIndex = this.getCellIndex(obj.position);

    if (!this.cells.has(cellIndex)) {
      this.cells.set(cellIndex, new Set());
    }
    this.cells.get(cellIndex)!.add(obj.id);
  }

  /**
   * Update an object's position (remove from old cell, add to new)
   */
  update(obj: Collidable): void {
    // Remove from all cells first (brute force, could optimize)
    for (const [cellIndex, ids] of this.cells) {
      ids.delete(obj.id);
    }

    // Re-insert
    this.insert(obj);
  }

  /**
   * Find all collisions
   * Returns pairs of colliding objects
   */
  detectCollisions(): Collision[] {
    const collisions: Collision[] = [];
    const checked = new Set<string>();  // "id1-id2" to avoid duplicates

    // For each cell
    for (const [cellIndex, objectIds] of this.cells) {
      const neighborCells = this.neighborTable.get(cellIndex) || [];
      const allCells = [cellIndex, ...neighborCells];

      // Collect all objects in this cell and neighbors
      const candidates: Collidable[] = [];
      for (const ci of allCells) {
        const ids = this.cells.get(ci);
        if (ids) {
          for (const id of ids) {
            const obj = this.objects.get(id);
            if (obj) candidates.push(obj);
          }
        }
      }

      // Check pairs within candidates
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i];
          const b = candidates[j];

          // Skip same-type collisions if needed
          if (a.type === b.type && a.type === 'projectile') continue;

          // Skip already checked pairs
          const pairKey = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);

          // Narrow phase: actual collision check
          const collision = this.checkCollision(a, b);
          if (collision) {
            collisions.push(collision);
          }
        }
      }
    }

    return collisions;
  }

  /**
   * Query objects near a position
   */
  queryNear(position: THREE.Vector3, angularRadius: number): Collidable[] {
    const cellIndex = this.getCellIndex(position);
    const neighborCells = this.neighborTable.get(cellIndex) || [];
    const allCells = [cellIndex, ...neighborCells];

    const results: Collidable[] = [];
    const threshold = Math.cos(angularRadius);

    for (const ci of allCells) {
      const ids = this.cells.get(ci);
      if (!ids) continue;

      for (const id of ids) {
        const obj = this.objects.get(id);
        if (!obj) continue;

        const dot = position.dot(obj.position);
        if (dot > threshold) {
          results.push(obj);
        }
      }
    }

    return results;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private checkCollision(a: Collidable, b: Collidable): Collision | null {
    const dot = a.position.dot(b.position);
    const threshold = Math.cos(a.angularRadius + b.angularRadius);

    if (dot > threshold) {
      // Collision detected
      const angularDistance = Math.acos(Math.min(1, Math.max(-1, dot)));
      return { a, b, angularDistance };
    }

    return null;
  }

  private getCellIndex(position: THREE.Vector3): number {
    // Implementation from earlier section
    // ... findBaseFace + subdivision
    return 0; // Placeholder
  }

  private precomputeNeighbors(): void {
    // Build neighbor lookup table
    // For each cell, store indices of adjacent cells
    const totalCells = 20 * Math.pow(4, this.subdivisionLevel);

    for (let i = 0; i < totalCells; i++) {
      this.neighborTable.set(i, this.computeNeighbors(i));
    }
  }

  private computeNeighbors(cellIndex: number): number[] {
    // Implementation depends on subdivision level
    // ... complex but precomputed once
    return [];
  }
}
```

### Integration with GameRenderer

All collision checks happen in **planet local space** for efficiency.

```typescript
// In GameRenderer.ts

import { SphericalCollisionSystem, type Collidable } from '@ft/supercluster';

export class GameRenderer {
  private collisionSystem: SphericalCollisionSystem;

  constructor(...) {
    // ... existing code ...

    this.collisionSystem = new SphericalCollisionSystem(1); // Level 1 = 80 cells
  }

  /**
   * Transform ship position from world space to planet local space
   */
  private getShipInPlanetSpace(): THREE.Vector3 {
    const localPos = this.shipPosition.clone();
    const inverseQuat = this.planetQuaternion.clone().invert();
    localPos.applyQuaternion(inverseQuat);
    return localPos;
  }

  private checkCollisions(): void {
    // Clear and rebuild spatial hash (all in planet local space)
    this.collisionSystem.clear();

    // Add ship (transformed to planet local space)
    const shipLocal = this.getShipInPlanetSpace();
    this.collisionSystem.insert({
      id: -1,  // Special ID for ship
      position: shipLocal,
      angularRadius: 0.03,  // Ship's angular radius
      type: 'ship',
    });

    // Add asteroids (already in planet local space - no transform needed!)
    for (const asteroid of this.asteroids.getAsteroids()) {
      // Calculate angular radius from visual size
      const visualSize = this.asteroids.SIZE_MULTIPLIERS[asteroid.size - 1];
      const angularRadius = visualSize / (2 * this.config.gameSphereRadius);

      this.collisionSystem.insert({
        id: asteroid.id,
        position: asteroid.position,  // Already in planet local space!
        angularRadius,
        type: 'asteroid',
      });
    }

    // Add projectiles (also in planet local space - no transform needed!)
    // Projectiles are children of planet group, just like asteroids
    for (const projectile of this.projectiles.getBullets()) {
      this.collisionSystem.insert({
        id: projectile.id,
        position: projectile.position,  // Already in planet local space!
        angularRadius: 0.005,  // Small angular radius for projectiles
        type: 'projectile',
      });
    }

    // Detect collisions
    const collisions = this.collisionSystem.detectCollisions();

    // Handle collisions
    for (const collision of collisions) {
      this.handleCollision(collision);
    }
  }

  private handleCollision(collision: Collision): void {
    const { a, b } = collision;

    // Ensure consistent ordering (ship/projectile first)
    const [obj1, obj2] = a.type === 'asteroid' ? [b, a] : [a, b];

    if (obj1.type === 'ship' && obj2.type === 'asteroid') {
      // Ship hit asteroid - lose life, trigger invincibility
      console.log('Ship hit asteroid!', obj2.id);
      // TODO: Reduce lives, trigger invincibility frames
    }

    if (obj1.type === 'projectile' && obj2.type === 'asteroid') {
      // Projectile hit asteroid - destroy projectile, break/destroy asteroid
      console.log('Projectile hit asteroid!', obj2.id);
      this.projectiles.remove(obj1.id);
      this.asteroids.breakAsteroid(obj2.id);
    }
  }
}
```

#### Key Points

1. **Ship**: Only object that needs transformation (world → planet local)
2. **Asteroids**: Already in planet local space (children of planet group)
3. **Projectiles**: Also in planet local space (will be children of planet group)
4. **Transforms per frame**: Just 1 (for the ship), regardless of object count

````

---

## Performance Analysis

### Complexity Comparison

| Approach | Build | Query | Total for n objects |
|----------|-------|-------|---------------------|
| Brute Force | O(1) | O(n²) | O(n²) |
| Icosahedral Grid | O(n) | O(n × k) | O(n × k) |

Where k = average objects per cell + neighbors (typically 3-10).

### Expected Performance

With 500 objects and 80 cells (level 1 subdivision):
- Average objects per cell: 500 / 80 ≈ 6
- Objects in cell + 3 neighbors: ≈ 24
- Pairs to check per cell: 24 × 23 / 2 ≈ 276
- But many are duplicates across cells

**Actual checks**: ~2,000-5,000 (vs 124,750 for brute force)
**Speedup**: ~25-60x

### Memory Usage

```typescript
// Per object: Collidable struct
const collidableSize =
  4 +      // id (number)
  24 +     // position (THREE.Vector3 = 3 × 8 bytes)
  8 +      // angularRadius (number)
  8;       // type (string reference)
// ≈ 44 bytes per object

// Spatial hash overhead:
// - Map<number, Set<number>>: ~100 bytes per cell
// - 80 cells × 100 = 8 KB

// Total for 500 objects:
// 500 × 44 + 8,000 ≈ 30 KB
````

---

## Projectile System Considerations

### Projectile as Point vs Ray

**Option 1: Point collision (simpler)**

- Treat projectile as a point (angularRadius ≈ 0)
- Check if point is within asteroid's angular radius
- Miss fast-moving projectiles (tunneling problem)

**Option 2: Ray/segment collision (more accurate)**

- Store projectile's previous position
- Check if the arc from prev to current intersects any asteroid
- Prevents tunneling for fast projectiles

```typescript
interface Projectile {
  id: number;
  position: THREE.Vector3;      // Current position (unit vector)
  prevPosition: THREE.Vector3;  // Previous frame position
  velocity: THREE.Vector3;      // Direction on sphere surface
  speed: number;                // Angular speed (rad/s)
}

function checkBulletAsteroidCollision(
  projectile: Projectile,
  asteroid: Collidable
): boolean {
  // Check if asteroid is near the arc from prevPosition to position

  // 1. Quick rejection: is asteroid anywhere near the projectile's path?
  const midpoint = projectile.prevPosition.clone()
    .add(projectile.position)
    .normalize();
  const pathRadius = projectile.prevPosition.angleTo(projectile.position) / 2;

  const distToMidpoint = Math.acos(midpoint.dot(asteroid.position));
  if (distToMidpoint > pathRadius + asteroid.angularRadius + 0.1) {
    return false;  // Too far from path
  }

  // 2. Detailed check: closest point on arc to asteroid center
  // ... more complex spherical geometry

  return true;  // Placeholder
}
```

### Projectile Array Optimization

For "array of projectiles" (stream of projectiles), consider:

```typescript
// Instead of individual projectiles, track the stream
interface BulletStream {
  startPosition: THREE.Vector3;  // Where stream originated
  direction: THREE.Vector3;       // Direction on sphere
  startTime: number;              // When firing started
  endTime: number | null;         // When firing stopped (null = still firing)
  speed: number;                  // Projectile speed
  spacing: number;                // Angular distance between projectiles
}

// Check collision with entire stream at once
function checkStreamCollision(
  stream: BulletStream,
  asteroid: Collidable,
  currentTime: number
): boolean {
  // Calculate which "segment" of the stream could hit the asteroid
  // Based on timing and positions
  // Much more efficient than checking 100 individual projectiles
}
```

---

## Alternative: Simpler First Implementation

If icosahedral grid feels complex, start with **latitude bands**:

```typescript
class SimpleLatitudeBands {
  private bands: Map<number, Set<number>>[] = [];
  private numBands = 20;

  constructor() {
    for (let i = 0; i < this.numBands; i++) {
      this.bands.push(new Map());
    }
  }

  private getBand(position: THREE.Vector3): number {
    // y ranges from -1 to 1 on unit sphere
    // Map to band index 0 to numBands-1
    const y = position.y;
    return Math.floor((y + 1) * this.numBands / 2);
  }

  insert(obj: Collidable): void {
    const band = this.getBand(obj.position);
    // Also insert into adjacent bands if object spans them
    // ...
  }
}
```

**Pros:** Dead simple
**Cons:** Pole distortion, but fine for initial testing

---

## Implementation Roadmap

### Phase 1: Basic Detection (No Spatial Hash)

1. Add angular radius to AsteroidData
2. Implement dot-product collision check
3. Check ship vs all asteroids each frame
4. Test with 12 asteroids

### Phase 2: Add Projectiles

1. Create Projectile class with position, velocity
2. Spawn projectiles at ship position + aim direction
3. Move projectiles along great circles
4. Check projectiles vs asteroids (brute force first)

### Phase 3: Spatial Partitioning

1. Implement simple latitude bands
2. Measure performance with 100+ asteroids
3. If needed, upgrade to icosahedral grid

### Phase 4: Optimization

1. Object pooling for projectiles
2. Batch collision responses
3. Consider Web Workers for physics

---

## References

- [Dot Product for Collision](https://www.gamedev.net/tutorials/programming/math-and-physics/dot-product-and-collision-detection-r4849/)
- [Spherical Geometry](https://en.wikipedia.org/wiki/Spherical_geometry)
- [Geodesic Grid](https://en.wikipedia.org/wiki/Geodesic_grid)
- [Three.js Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Three.js Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
