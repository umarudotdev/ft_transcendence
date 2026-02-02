# GLSL Shaders in SuperCluster

This document explains how shaders work in the SuperCluster game, specifically the force field effect.

---

## What Are Shaders?

Shaders are small programs that run on the **GPU** (graphics card) instead of the CPU. They process graphics data in parallel, making them extremely fast for visual effects.

```
CPU (JavaScript/TypeScript)          GPU (GLSL Shaders)
┌─────────────────────────┐         ┌─────────────────────────┐
│ - Game logic            │         │ - Process vertices      │
│ - User input            │  ───►   │ - Calculate colors      │
│ - Scene setup           │         │ - Runs in parallel      │
│ - Slow for graphics     │         │ - Millions of ops/sec   │
└─────────────────────────┘         └─────────────────────────┘
```

---

## GLSL: The Shader Language

**GLSL** (OpenGL Shading Language) is a C-like language designed for GPU programming.

### GLSL vs C Comparison

```glsl
// GLSL code
void main() {
    vec3 normal = normalize(vWorldPosition);  // vec3 is built-in
    float facing = dot(normal, viewDir);       // dot() is built-in
    gl_FragColor = vec4(uColor, opacity);      // special output variable
}
```

### Key Differences from C

| Feature | C | GLSL |
|---------|---|------|
| Vector types | Not built-in | `vec2`, `vec3`, `vec4` |
| Matrix types | Not built-in | `mat2`, `mat3`, `mat4` |
| Math functions | Need library | Built-in (`sin`, `cos`, `dot`, etc.) |
| Pointers | Yes | No |
| Strings | Yes | No |
| Dynamic memory | Yes | No |
| Runs on | CPU (sequential) | GPU (parallel) |

### Built-in Types

```glsl
// Scalars
float f = 1.0;
int i = 1;
bool b = true;

// Vectors (2, 3, or 4 components)
vec2 v2 = vec2(1.0, 2.0);
vec3 v3 = vec3(1.0, 2.0, 3.0);
vec4 v4 = vec4(1.0, 2.0, 3.0, 4.0);  // Often used for RGBA colors

// Matrices
mat3 m3;  // 3x3 matrix
mat4 m4;  // 4x4 matrix (common for transformations)

// Accessing components
v3.x, v3.y, v3.z        // Position notation
v3.r, v3.g, v3.b        // Color notation (same thing)
v4.rgba                  // All 4 components
v3.xy                    // First 2 components as vec2 (swizzling)
```

### Built-in Math Functions

```glsl
normalize(v)      // Make vector length = 1
dot(a, b)         // Dot product: a.x*b.x + a.y*b.y + a.z*b.z
cross(a, b)       // Cross product (3D only)
length(v)         // Vector length
distance(a, b)    // Distance between two points
mix(a, b, t)      // Linear interpolation: a*(1-t) + b*t
clamp(x, min, max)// Constrain value to range
sin(x), cos(x)    // Trigonometry
pow(x, y)         // x to the power of y
abs(x)            // Absolute value
min(a, b), max(a, b)
```

---

## Two Types of Shaders

Every rendered object needs both a **vertex shader** and a **fragment shader**.

### The Rendering Pipeline

```
Geometry (vertices)
        │
        ▼
┌───────────────────┐
│   VERTEX SHADER   │  Runs once per vertex
│   - Transform 3D  │  Input: vertex position
│     positions     │  Output: screen position
└───────────────────┘
        │
        ▼
    Rasterization      (GPU automatically determines which pixels to fill)
        │
        ▼
┌───────────────────┐
│  FRAGMENT SHADER  │  Runs once per pixel
│   - Calculate     │  Input: interpolated data
│     pixel color   │  Output: RGBA color
└───────────────────┘
        │
        ▼
    Final Image
```

### Vertex Shader

Runs **once per vertex** in your geometry. Main job: transform 3D coordinates to screen coordinates.

```glsl
// Required output
gl_Position = vec4(x, y, z, w);  // Where this vertex appears on screen
```

### Fragment Shader

Runs **once per pixel** (fragment) that the geometry covers. Main job: determine the color of each pixel.

```glsl
// Required output
gl_FragColor = vec4(r, g, b, a);  // RGBA color of this pixel
```

---

## Variable Types in GLSL

### 1. `uniform` - Constants from JavaScript

Same value for **all** vertices and pixels. Set from JavaScript code.

```glsl
// GLSL side
uniform vec3 uColor;           // Receive from JS
uniform float uOpacity;

// JavaScript side (Three.js)
material.uniforms.uColor.value = new THREE.Color(0xff0000);
material.uniforms.uOpacity.value = 0.5;
```

**Important:** The uniform name in GLSL must **exactly match** the key name in JavaScript.

### 2. `attribute` - Per-Vertex Data

Different value for **each vertex**. Comes from the geometry.

```glsl
attribute vec3 position;  // Vertex position (Three.js provides this)
attribute vec3 normal;    // Vertex normal
attribute vec2 uv;        // Texture coordinates
```

Three.js automatically provides common attributes. You can add custom ones via `BufferGeometry`.

### 3. `varying` - Vertex → Fragment Communication

Passes data from vertex shader to fragment shader. The GPU **interpolates** values between vertices.

```glsl
// Vertex shader
varying vec3 vWorldPosition;

void main() {
    vWorldPosition = worldPos.xyz;  // Write value
    gl_Position = ...;
}

// Fragment shader
varying vec3 vWorldPosition;        // Same name!

void main() {
    vec3 pos = vWorldPosition;      // Read interpolated value
    gl_FragColor = ...;
}
```

### Interpolation Explained

```
Vertex A                              Vertex B
vWorldPosition = (0, 0, 0)            vWorldPosition = (10, 0, 0)
        ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━●
        │         │         │        │
     (0,0,0)   (2.5,0,0)  (5,0,0)  (10,0,0)

        Each pixel gets an interpolated value
        based on its position between vertices
```

### Summary Table

| Keyword | Direction | Scope | Example Use |
|---------|-----------|-------|-------------|
| `uniform` | JS → GPU | All vertices/pixels | Color, opacity, camera position |
| `attribute` | Geometry → Vertex | Per vertex | Position, normal, UV |
| `varying` | Vertex → Fragment | Interpolated per pixel | World position, custom data |

---

## Three.js ShaderMaterial

Three.js provides `ShaderMaterial` to use custom GLSL shaders.

### Basic Structure

```typescript
const material = new THREE.ShaderMaterial({
    uniforms: {
        uColor: { value: new THREE.Color(0x00ffaa) },
        uOpacity: { value: 0.5 },
    },
    vertexShader: `
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;

        void main() {
            gl_FragColor = vec4(uColor, uOpacity);
        }
    `,
    transparent: true,
});
```

### Shader Code as Strings

In TypeScript, shader code is just a **string**. We use template literals (backticks) for multi-line strings:

```typescript
// shaders/myShader.ts
export const myVertexShader = `
    varying vec3 vPosition;

    void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const myFragmentShader = `
    uniform vec3 uColor;
    varying vec3 vPosition;

    void main() {
        gl_FragColor = vec4(uColor, 1.0);
    }
`;
```

**Note:** These are regular strings, not special types. TypeScript has no awareness of GLSL syntax.

### Variables Injected by Three.js

Three.js automatically adds these variables to your shaders:

#### Uniforms (available in both shaders)

```glsl
uniform mat4 modelMatrix;       // Object → World transformation
uniform mat4 viewMatrix;        // World → Camera transformation
uniform mat4 projectionMatrix;  // Camera → Screen transformation
uniform mat4 modelViewMatrix;   // modelMatrix * viewMatrix (optimization)
uniform mat3 normalMatrix;      // For transforming normals correctly
uniform vec3 cameraPosition;    // Camera position in world space
```

#### Attributes (vertex shader only)

```glsl
attribute vec3 position;  // Vertex position in local space
attribute vec3 normal;    // Vertex normal
attribute vec2 uv;        // Texture coordinates
```

### The Transformation Pipeline

To display a 3D point on a 2D screen, we multiply by transformation matrices:

```
position (local/object space)
    │
    │  × modelMatrix
    ▼
World Space (position in the 3D world)
    │
    │  × viewMatrix
    ▼
View/Camera Space (position relative to camera)
    │
    │  × projectionMatrix
    ▼
Clip Space (gl_Position) → Screen coordinates
```

Common patterns:

```glsl
// Full transformation (most common)
gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);

// Using pre-combined matrix (slightly faster)
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

// Getting world position for fragment shader
vec4 worldPos = modelMatrix * vec4(position, 1.0);
vWorldPosition = worldPos.xyz;
```

---

## Force Field Shader Explained

The force field in SuperCluster uses a custom shader to fade lines based on their orientation relative to the camera.

### The Goal

- Lines facing the camera → **more visible** (higher opacity)
- Lines facing away → **less visible** (lower opacity)
- Creates depth perception on a wireframe sphere

### Complete Shader Code

**Vertex Shader** (`forceField.ts`):

```glsl
varying vec3 vWorldPosition;

void main() {
    // Transform vertex position from local to world space
    vec4 worldPos = modelMatrix * vec4(position, 1.0);

    // Pass world position to fragment shader
    vWorldPosition = worldPos.xyz;

    // Transform to screen coordinates
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

**Fragment Shader** (`forceField.ts`):

```glsl
uniform vec3 uColor;          // Line color (from JavaScript)
uniform float uOpacityFront;  // Opacity for front-facing parts
uniform float uOpacityBack;   // Opacity for back-facing parts
uniform vec3 uCameraPos;      // Camera position in world space

varying vec3 vWorldPosition;  // Interpolated from vertex shader

void main() {
    // For a sphere centered at origin, the normal at any point
    // is simply the normalized position vector
    vec3 normal = normalize(vWorldPosition);

    // Direction from this point toward the camera
    vec3 viewDir = normalize(uCameraPos - vWorldPosition);

    // Dot product tells us how much the surface faces the camera
    // +1.0 = directly facing camera
    //  0.0 = perpendicular (edge)
    // -1.0 = facing away from camera
    float facing = dot(normal, viewDir);

    // Convert from [-1, +1] range to [0, 1] range
    float facingNormalized = (facing + 1.0) * 0.5;

    // Interpolate between back and front opacity
    float opacity = mix(uOpacityBack, uOpacityFront, facingNormalized);

    // Output final color with calculated opacity
    gl_FragColor = vec4(uColor, opacity);
}
```

### How the Dot Product Works

The dot product of two unit vectors gives the cosine of the angle between them:

```
Camera looking at sphere:

         Camera
            │
            ▼
    ┌───────────────┐
    │   facing=+1   │  ← Normal points toward camera (dot ≈ 1)
    │               │
    ├───────────────┤  ← Normal perpendicular (dot ≈ 0)
    │               │
    │   facing=-1   │  ← Normal points away (dot ≈ -1)
    └───────────────┘

dot(normal, viewDir):
  +1.0 = vectors point same direction (front)
   0.0 = vectors are perpendicular (edge)
  -1.0 = vectors point opposite directions (back)
```

### The `mix()` Function

`mix(a, b, t)` performs linear interpolation:

```glsl
mix(a, b, t) = a * (1.0 - t) + b * t

// When t = 0.0 → returns a
// When t = 0.5 → returns (a + b) / 2
// When t = 1.0 → returns b
```

Example with our opacity values:

```
uOpacityBack = 0.0
uOpacityFront = 0.4

facing = -1.0 → t = 0.0 → opacity = 0.0  (invisible)
facing =  0.0 → t = 0.5 → opacity = 0.2  (half visible)
facing = +1.0 → t = 1.0 → opacity = 0.4  (full visibility)
```

---

## Connecting JavaScript to GLSL

### Setting Uniform Values

```typescript
// In Planet.ts - Creating the material
const material = new THREE.ShaderMaterial({
    uniforms: {
        uColor: { value: new THREE.Color(0x00ffaa) },
        uOpacityFront: { value: 0.4 },
        uOpacityBack: { value: 0.1 },
        uCameraPos: { value: camera.position },
    },
    vertexShader: forceFieldVertexShader,
    fragmentShader: forceFieldFragmentShader,
    transparent: true,
    depthWrite: false,
});

// Updating uniforms at runtime
material.uniforms.uOpacityFront.value = 0.8;
material.uniforms.uColor.value.setHex(0xff0000);
```

### Name Matching

The uniform name in JavaScript **must exactly match** the GLSL variable name:

```typescript
// JavaScript
uniforms: {
    uColor: { value: ... },  // ← Key: "uColor"
}
```

```glsl
// GLSL
uniform vec3 uColor;  // ← Name: "uColor" (must match!)
```

If names don't match, the value won't be passed (silent failure, no error).

---

## WebGL and GLSL Versions

### Checking Your Version

```typescript
// In browser console or code
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

if (gl instanceof WebGL2RenderingContext) {
    console.log('WebGL 2.0');
} else {
    console.log('WebGL 1.0');
}

console.log('GLSL:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

// With Three.js
console.log('WebGL 2:', renderer.capabilities.isWebGL2);
```

### Version Differences

| WebGL | GLSL Version | Syntax |
|-------|--------------|--------|
| 1.0 | GLSL ES 1.00 | `attribute`, `varying`, `gl_FragColor` |
| 2.0 | GLSL ES 3.00 | `in`, `out`, custom output names |

Three.js uses GLSL 1.00 syntax by default for compatibility. Most browsers support WebGL 2.0 now.

### Modern GLSL (Optional)

```glsl
#version 300 es
precision highp float;

// Vertex shader
in vec3 position;      // Instead of 'attribute'
out vec3 vPosition;    // Instead of 'varying'

// Fragment shader
in vec3 vPosition;     // Instead of 'varying'
out vec4 fragColor;    // Instead of 'gl_FragColor'
```

---

## Complete Force Field Creation Flow

Here's how all the pieces fit together:

### Step 1: Create Geometry

```typescript
// IcosahedronGeometry creates uniform triangles (unlike SphereGeometry)
const geometry = new THREE.IcosahedronGeometry(radius, detail);
```

### Step 2: Convert to Wireframe

```typescript
// Extract only the edges (no filled triangles)
const wireframe = new THREE.WireframeGeometry(geometry);
```

### Step 3: Create Shader Material

```typescript
const material = new THREE.ShaderMaterial({
    uniforms: { ... },
    vertexShader: forceFieldVertexShader,
    fragmentShader: forceFieldFragmentShader,
    transparent: true,
    depthWrite: false,  // Don't block objects behind it
});
```

### Step 4: Create Mesh

```typescript
// LineSegments renders as lines, not triangles
const forceField = new THREE.LineSegments(wireframe, material);
```

### Step 5: Add to Scene

```typescript
scene.add(forceField);
```

### Every Frame (Render Loop)

```
For each line segment:

1. VERTEX SHADER runs for each endpoint (2 times per line)
   - Transforms position to screen coordinates
   - Calculates world position for fragment shader

2. GPU rasterizes the line (determines which pixels to draw)

3. FRAGMENT SHADER runs for each pixel on the line
   - Receives interpolated vWorldPosition
   - Calculates facing direction
   - Outputs color with appropriate opacity
```

---

## Debugging Shaders

### Common Issues

1. **Black screen / Nothing renders**
   - Check browser console for GLSL compile errors
   - Verify uniform names match exactly
   - Ensure geometry has vertices

2. **Uniform not updating**
   - Check name spelling (case-sensitive)
   - Make sure you're updating `.value`, not the uniform itself

3. **Wrong colors/positions**
   - Add debug output: `gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);` (red)
   - Visualize normals: `gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);`

### Three.js Shader Debugging

```typescript
// Log compiled shader code
console.log(material.vertexShader);
console.log(material.fragmentShader);

// Check for errors after first render
renderer.render(scene, camera);
console.log(renderer.info.programs);
```

---

## Learning Resources

- **The Book of Shaders**: https://thebookofshaders.com/ (best beginner tutorial)
- **Shadertoy**: https://shadertoy.com (examples and experiments)
- **Three.js ShaderMaterial**: https://threejs.org/docs/#api/en/materials/ShaderMaterial
- **Three.js WebGLProgram** (built-in variables): https://threejs.org/docs/#api/en/renderers/webgl/WebGLProgram
- **GLSL Reference**: https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language
