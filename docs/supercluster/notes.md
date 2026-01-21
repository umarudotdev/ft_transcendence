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

The ship mesh is positioned at its spherical coordinates, but visually the planet rotates under it to create the illusion of movement.

---

## Force-Field Shader

Custom ShaderMaterial for force-field wireframe that fades lines facing away from camera:

- Vertex shader passes world position to fragment shader
- Fragment shader calculates normal (for sphere: `normalize(position)`)
- Dot product with view direction determines facing: 1=toward camera, -1=away
- Interpolates between front opacity and back opacity based on facing

For wireframe `LineSegments`, normals aren't available directly, but for a sphere centered at origin, the normal at any point equals the normalized position vector.

---

## Ship Orientation

The ship's orientation on the sphere surface:

1. **Normal** = direction away from sphere center (local Z up)
2. **East** = cross(worldUp, normal) - tangent pointing toward increasing theta
3. **North** = cross(normal, east) - tangent pointing toward decreasing phi (toward north pole)

The ship's triangle tip points "north" by default, then rotates by aimAngle around the normal.

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

## Ideas for Later

- Asteroid breaking into smaller pieces (like original Super Stardust)
- Different weapon types (spread, focused, beam)
- Boost/dash ability with cooldown
- Shield power-up
- Particle effects for explosions
- Glow effect on force-field
- Post-processing (bloom, color grading)

---

## Performance Notes

### When to Use InstancedMesh/BatchedMesh
- **InstancedMesh**: For many identical objects (asteroids, same enemy type)
- **BatchedMesh**: If we need different geometries with same material
- For now (few objects), regular Mesh is fine

---

## Useful Resources

- Three.js Vector3.setFromSphericalCoords()
- Three.js InstancedMesh for many objects
- Haversine formula for angular distance on sphere
- Material.depthTest: https://threejs.org/docs/#api/en/materials/Material.depthTest
- ShaderMaterial for custom effects: https://threejs.org/docs/#api/en/materials/ShaderMaterial
