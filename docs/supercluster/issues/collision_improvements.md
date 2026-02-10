# 3. Collision-specific issues & improvements

This section summarizes the key collision correctness and robustness upgrades for a **Super Stardust–style spherical shooter**.

---

## 3.1 Distance on a sphere ≠ Euclidean distance

If you check collisions like:

```ts
projectile.position.distanceTo(asteroid.position) < radiusSum
```

this is only valid for flat space.  
On a sphere you need **angular distance**:

```ts
angle = acos(dot(p1, p2))
```

Collision becomes:

```ts
angle < (rBullet + rAsteroid) / SPHERE_RADIUS
```

### Recommended helper

```ts
function angularDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  const d = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  return Math.acos(d);
}
```

---

## 3.2 Projectile tunneling (fast projectiles skipping hits)

Projectiles can move far between frames:

- high speed
- small asteroids
- low FPS spikes

→ they may jump over targets.

### Solution A: Swept collision (best)

Check collision against the **arc path** traveled this frame.

### Solution B: Sub-stepping (simpler)

Split projectile motion into smaller steps:

```ts
const steps = Math.ceil(angle / maxSafeAngle);

for (...) {
  move projectile by angle/steps;
  test collision;
}
```

Very common in arcade shooters.

---

## 3.3 Broad-phase early rejection

Naive loops are:

```
for projectile
  for asteroid
    test collision
```

O(N×M).

On a sphere you can reject cheaply using dot products:

```ts
if (projectile.position.dot(asteroid.position) < cosThreshold) continue;
```

Only do expensive math when close.

---

## 3.4 Asteroid size should map to angular radius

Make collision radii explicit:

```ts
const asteroidAngularRadius =
  ASTEROID_RADIUS[size] / GAME_CONST.SPHERE_RADIUS;
```

Then collision tuning becomes data-driven instead of magic numbers.

---
