# SuperCluster Concepts

Educational documentation explaining the technical concepts behind SuperCluster.

---

## Contents

### [Svelte Basics](./svelte-basics.md)

Understanding Svelte 5 concepts used in SuperCluster:

- Components and hierarchy (parent/child)
- Props and reactive state (`$state()`)
- Lifecycle (`onMount`, `onDestroy`)
- Exported functions (public API)
- Event listeners

### [Collision Detection](./collision.md)

Spherical collision detection system:

- Unit vectors for positions
- Angular distance and radius
- Dot product collision checks
- Coordinate space transformation
- Spatial partitioning (icosahedral grid)

### [Movement on a Sphere](./movement.md)

How movement works on a sphere surface:

- Planet movement (WASD illusion)
- Asteroid drift (`moveOnSphere`)
- Quaternion-based rotation
- Avoiding gimbal lock

### [GLSL Shaders](./shaders.md)

GPU shader programming for visual effects:

- GLSL language basics
- Vertex vs fragment shaders
- Uniforms, attributes, varyings
- Force field effect implementation
- Three.js ShaderMaterial

### [Client-Side Prediction](./client-side-prediction.md)

Networked game responsiveness techniques:

- The latency problem
- Client-side prediction (immediate feedback)
- Sequence numbers and input tracking
- Server reconciliation
- Misprediction and smoothing

---

## How These Docs Are Organized

```
docs/supercluster/
├── concepts/                 ← Educational (you are here)
│   ├── index.md
│   ├── svelte-basics.md
│   ├── collision.md
│   ├── movement.md
│   ├── shaders.md
│   └── client-side-prediction.md
│
├── refactoring/              ← Work-in-progress plans
│   └── game-state-refactor.md
│
├── variables-audit.md        ← Constants and config reference
├── configuration.md          ← How config works
├── future-architecture.md
├── coding-standards.md
├── notes.md
└── goals.md
```

**Concepts** = Understanding how things work (theory)
**Reference docs** = How to use/configure things (practical)
