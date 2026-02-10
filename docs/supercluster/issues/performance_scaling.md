# 4. Performance & scaling notes (collision-adjacent)

These are improvements that matter once bullet/asteroid counts grow.

---

## 4.1 Avoid splice removals in hot loops (later)

Right now removal uses:

```ts
array.splice(i, 1);
```

This shifts memory and becomes expensive at scale.

### Better: swap-remove

- swap element with last
- pop
- update swapped index

O(1) removal.

---

## 4.2 Separate simulation from rendering

Long-term cleaner architecture:

- **BulletSystem** → owns bullet data + collision
- **BulletRenderer** → only draws bullet data

You are already close to this split.

Collision logic stays independent from InstancedMesh code.

---
